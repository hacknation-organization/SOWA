from fastapi import APIRouter, HTTPException, Response, status
from sqlmodel import delete, select

from app.api.deps import CurrentUser, SessionDep, get_process_for_read, get_process_for_write
from app.domain.competency_model import get_competency_model
from app.domain.process_flow import validate_type_form
from app.domain.scoring import suggest_level
from app.models import Decision, Employee, Process, ProcessCompetency, Rating
from app.models.entities import utcnow
from app.pdf.generator import render_process_pdf
from app.schemas import (
    CriteriaUpdate,
    DecisionOut,
    DecisionUpdate,
    ProcessCreate,
    ProcessDetail,
    ProcessListItem,
    ProcessUpdate,
    RatingOut,
    RatingUpdate,
    SummaryItem,
)
from app.services import processes as svc

router = APIRouter(prefix="/processes", tags=["procesy oceny"])


def _touch(session, process: Process) -> None:
    process.updated_at = utcnow()
    session.add(process)


@router.get("", response_model=list[ProcessListItem])
def list_processes(session: SessionDep, user: CurrentUser) -> list[ProcessListItem]:
    """Procesy zalogowanego przełożonego (HR/admin widzą wszystkie)."""
    query = select(Process).order_by(Process.updated_at.desc())
    if user.role == "przelozony":
        query = query.where(Process.manager_id == user.id)
    return [svc.list_item(session, p) for p in session.exec(query).all()]


@router.post("", response_model=ProcessDetail, status_code=status.HTTP_201_CREATED)
def create_process(body: ProcessCreate, session: SessionDep, user: CurrentUser) -> ProcessDetail:
    if user.role not in ("przelozony", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Proces oceny zakłada przełożony")
    if error := validate_type_form(body.type, body.form):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, error)
    employee = session.get(Employee, body.employee_id)
    if employee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pracownik nie istnieje")
    if user.role == "przelozony" and employee.manager_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "To nie jest Twój podwładny")
    process = Process(
        employee_id=employee.id,
        manager_id=user.id if user.role == "przelozony" else (employee.manager_id or user.id),
        type=body.type,
        form=body.form,
        period_start=body.period_start,
        period_end=body.period_end,
        deadline=body.deadline,
    )
    session.add(process)
    session.commit()
    session.refresh(process)
    return svc.detail(session, process)


@router.get("/{process_id}", response_model=ProcessDetail)
def get_process(process_id: int, session: SessionDep, user: CurrentUser) -> ProcessDetail:
    return svc.detail(session, get_process_for_read(session, process_id, user))


@router.patch("/{process_id}", response_model=ProcessDetail)
def update_process(
    process_id: int, body: ProcessUpdate, session: SessionDep, user: CurrentUser
) -> ProcessDetail:
    """Zmiana etapu, opisu stanowiska (OSP), danych rozmowy, planu rozwoju lub statusu."""
    process = get_process_for_write(session, process_id, user)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(process, key, value)
    _touch(session, process)
    session.commit()
    session.refresh(process)
    return svc.detail(session, process)


@router.put("/{process_id}/criteria", response_model=ProcessDetail)
def set_criteria(
    process_id: int, body: CriteriaUpdate, session: SessionDep, user: CurrentUser
) -> ProcessDetail:
    process = get_process_for_write(session, process_id, user)
    model = get_competency_model()
    ids = list(dict.fromkeys(body.competency_ids))
    unknown = [cid for cid in ids if model.competency(cid) is None]
    if unknown:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, f"Nieznane kompetencje: {', '.join(unknown)}"
        )
    session.exec(delete(ProcessCompetency).where(ProcessCompetency.process_id == process.id))
    # oceny i decyzje dla kompetencji usuniętych z kryteriów przestają obowiązywać
    session.exec(delete(Rating).where(Rating.process_id == process.id, Rating.competency_id.not_in(ids)))
    session.exec(
        delete(Decision).where(Decision.process_id == process.id, Decision.competency_id.not_in(ids))
    )
    for pos, cid in enumerate(ids):
        session.add(ProcessCompetency(process_id=process.id, competency_id=cid, position=pos))
    _touch(session, process)
    session.commit()
    session.refresh(process)
    return svc.detail(session, process)


@router.put("/{process_id}/ratings/{indicator_id}", response_model=RatingOut)
def set_rating(
    process_id: int, indicator_id: str, body: RatingUpdate, session: SessionDep, user: CurrentUser
) -> RatingOut:
    """Ocena wskaźnika: level 1–5 albo null = „brak podstaw do oceny”."""
    process = get_process_for_write(session, process_id, user)
    found = get_competency_model().indicator(indicator_id)
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nieznany wskaźnik")
    comp, _ = found
    if comp["id"] not in svc.criteria_ids(session, process.id):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Kompetencja tego wskaźnika nie jest wybrana jako kryterium"
        )
    rating = session.exec(
        select(Rating).where(Rating.process_id == process.id, Rating.indicator_id == indicator_id)
    ).first() or Rating(process_id=process.id, competency_id=comp["id"], indicator_id=indicator_id)
    rating.level = body.level
    rating.example = body.example
    rating.updated_at = utcnow()
    session.add(rating)
    _touch(session, process)
    session.commit()
    return RatingOut(
        indicator_id=indicator_id, competency_id=comp["id"], level=rating.level, example=rating.example
    )


@router.delete("/{process_id}/ratings/{indicator_id}", status_code=status.HTTP_204_NO_CONTENT)
def clear_rating(process_id: int, indicator_id: str, session: SessionDep, user: CurrentUser) -> Response:
    process = get_process_for_write(session, process_id, user)
    session.exec(delete(Rating).where(Rating.process_id == process.id, Rating.indicator_id == indicator_id))
    _touch(session, process)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{process_id}/summary", response_model=list[SummaryItem])
def get_summary(process_id: int, session: SessionDep, user: CurrentUser) -> list[SummaryItem]:
    """Sugerowany poziom (mediana, deterministycznie) + decyzja przełożonego dla każdej kompetencji."""
    return svc.summary(session, get_process_for_read(session, process_id, user))


@router.put("/{process_id}/decisions/{competency_id}", response_model=DecisionOut)
def set_decision(
    process_id: int, competency_id: str, body: DecisionUpdate, session: SessionDep, user: CurrentUser
) -> DecisionOut:
    """Ostateczny poziom ustala przełożony; odejście od sugestii wymaga uzasadnienia."""
    process = get_process_for_write(session, process_id, user)
    comp = get_competency_model().competency(competency_id)
    if comp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nieznana kompetencja")
    if competency_id not in svc.criteria_ids(session, process.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Kompetencja nie jest wybrana jako kryterium")
    levels = [r.level for r in svc.ratings_for(session, process.id) if r.competency_id == competency_id]
    suggested = suggest_level(levels, total=len(comp["indicators"])).suggested_level
    justification = (body.justification or "").strip() or None
    if body.level != suggested and not justification:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Poziom {body.level} różni się od sugerowanego ({suggested}) – podaj uzasadnienie",
        )
    decision = session.exec(
        select(Decision).where(Decision.process_id == process.id, Decision.competency_id == competency_id)
    ).first() or Decision(process_id=process.id, competency_id=competency_id, level=body.level)
    decision.level = body.level
    decision.suggested_level = suggested
    decision.justification = justification
    decision.updated_at = utcnow()
    session.add(decision)
    _touch(session, process)
    session.commit()
    return DecisionOut(
        competency_id=competency_id,
        level=decision.level,
        suggested_level=suggested,
        justification=justification,
    )


@router.get(
    "/{process_id}/pdf",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}, "description": "Arkusz oceny w PDF"}},
)
def get_pdf(process_id: int, session: SessionDep, user: CurrentUser) -> Response:
    process = get_process_for_read(session, process_id, user)
    pdf = render_process_pdf(session, process)
    filename = f"arkusz-oceny-{process.id}.pdf"
    return Response(
        pdf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )
