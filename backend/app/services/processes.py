"""Operacje na procesach oceny łączące bazę danych z logiką domenową."""

from datetime import date

from sqlmodel import Session, select

from app.domain.competency_model import get_competency_model
from app.domain.process_flow import STAGES
from app.domain.scoring import suggest_level
from app.models import Decision, Employee, Process, ProcessCompetency, Rating, User
from app.schemas import (
    DecisionOut,
    EmployeeOut,
    ProcessDetail,
    ProcessListItem,
    RatingOut,
    SummaryItem,
)


def criteria_ids(session: Session, process_id: int) -> list[str]:
    rows = session.exec(
        select(ProcessCompetency)
        .where(ProcessCompetency.process_id == process_id)
        .order_by(ProcessCompetency.position)
    ).all()
    return [r.competency_id for r in rows]


def ratings_for(session: Session, process_id: int) -> list[Rating]:
    return list(session.exec(select(Rating).where(Rating.process_id == process_id)).all())


def decisions_for(session: Session, process_id: int) -> list[Decision]:
    return list(session.exec(select(Decision).where(Decision.process_id == process_id)).all())


def is_overdue(process: Process, today: date | None = None) -> bool:
    today = today or date.today()
    return process.status != "completed" and process.deadline is not None and process.deadline < today


def progress(session: Session, process_id: int) -> float:
    model = get_competency_model()
    total = 0
    for cid in criteria_ids(session, process_id):
        comp = model.competency(cid)
        total += len(comp["indicators"]) if comp else 0
    if total == 0:
        return 0.0
    selected = set(criteria_ids(session, process_id))
    done = sum(1 for r in ratings_for(session, process_id) if r.competency_id in selected)
    return round(done / total, 3)


def summary(session: Session, process: Process) -> list[SummaryItem]:
    model = get_competency_model()
    ratings = ratings_for(session, process.id)
    decisions = {d.competency_id: d for d in decisions_for(session, process.id)}
    items = []
    for cid in criteria_ids(session, process.id):
        comp = model.competency(cid)
        if comp is None:
            continue
        levels = [r.level for r in ratings if r.competency_id == cid]
        s = suggest_level(levels, total=len(comp["indicators"]))
        d = decisions.get(cid)
        items.append(
            SummaryItem(
                competency_id=cid,
                competency_name=comp["name"],
                rated=s.rated,
                total=s.total,
                no_basis=s.no_basis,
                rated_levels=s.rated_levels,
                suggested_level=s.suggested_level,
                explanation=s.explanation,
                manager_level=d.level if d else None,
                justification=d.justification if d else None,
            )
        )
    return items


def list_item(session: Session, process: Process) -> ProcessListItem:
    employee = session.get(Employee, process.employee_id)
    return ProcessListItem(
        id=process.id,
        employee=EmployeeOut.model_validate(employee),
        type=process.type,
        form=process.form,
        stage=process.stage,
        status=process.status,
        deadline=process.deadline,
        overdue=is_overdue(process),
        progress=progress(session, process.id),
        updated_at=process.updated_at,
    )


def detail(session: Session, process: Process) -> ProcessDetail:
    base = list_item(session, process)
    manager = session.get(User, process.manager_id)
    return ProcessDetail(
        **base.model_dump(),
        stages=STAGES,
        manager_name=manager.display_name if manager else "",
        period_start=process.period_start,
        period_end=process.period_end,
        job_description=process.job_description,
        interview_date=process.interview_date,
        interview_notes=process.interview_notes,
        development_plan=process.development_plan,
        criteria=criteria_ids(session, process.id),
        ratings=[
            RatingOut(
                indicator_id=r.indicator_id, competency_id=r.competency_id, level=r.level, example=r.example
            )
            for r in ratings_for(session, process.id)
        ],
        decisions=[
            DecisionOut(
                competency_id=d.competency_id,
                level=d.level,
                suggested_level=d.suggested_level,
                justification=d.justification,
            )
            for d in decisions_for(session, process.id)
        ],
        created_at=process.created_at,
    )


def anonymized_context(session: Session, process: Process) -> dict:
    """Kontekst procesu dla asystenta AI – bez imienia i nazwiska pracownika."""
    model = get_competency_model()
    employee = session.get(Employee, process.employee_id)
    ratings = ratings_for(session, process.id)
    competencies = []
    for item in summary(session, process):
        comp = model.competency(item.competency_id)
        indicators = []
        for r in ratings:
            if r.competency_id != item.competency_id:
                continue
            found = model.indicator(r.indicator_id)
            indicators.append(
                {
                    "indicator": found[1]["name"] if found else r.indicator_id,
                    "level": r.level,
                    "level_label": found[1]["levels"][r.level - 1]["label"] if found and r.level else None,
                    "behaviour": found[1]["levels"][r.level - 1]["description"]
                    if found and r.level
                    else None,
                    "example": r.example,
                }
            )
        competencies.append(
            {
                "competency": comp["name"] if comp else item.competency_id,
                "suggested_level": item.suggested_level,
                "manager_level": item.manager_level,
                "justification": item.justification,
                "indicators": indicators,
            }
        )
    return {
        "process_id": process.id,
        "type": process.type,
        "form": process.form,
        "stage": process.stage,
        "position": employee.position if employee else None,
        "period_start": process.period_start.isoformat() if process.period_start else None,
        "period_end": process.period_end.isoformat() if process.period_end else None,
        "competencies": competencies,
    }
