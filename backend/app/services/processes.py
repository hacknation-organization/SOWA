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
    return [row.competency_id for row in rows]


def ratings_for(session: Session, process_id: int) -> list[Rating]:
    return list(session.exec(select(Rating).where(Rating.process_id == process_id)).all())


def decisions_for(session: Session, process_id: int) -> list[Decision]:
    return list(session.exec(select(Decision).where(Decision.process_id == process_id)).all())


def is_overdue(process: Process, today: date | None = None) -> bool:
    today = today or date.today()
    return process.status != "completed" and process.deadline is not None and process.deadline < today


def progress(session: Session, process_id: int) -> float:
    model = get_competency_model()
    selected = criteria_ids(session, process_id)
    total = sum(len(comp["indicators"]) for cid in selected if (comp := model.competency(cid)))
    if total == 0:
        return 0.0
    done = sum(1 for rating in ratings_for(session, process_id) if rating.competency_id in selected)
    return round(done / total, 3)


def summary(session: Session, process: Process) -> list[SummaryItem]:
    model = get_competency_model()
    ratings = ratings_for(session, process.id)
    decisions = {decision.competency_id: decision for decision in decisions_for(session, process.id)}
    items = []
    for cid in criteria_ids(session, process.id):
        comp = model.competency(cid)
        if comp is None:
            continue
        levels = [rating.level for rating in ratings if rating.competency_id == cid]
        suggestion = suggest_level(levels, total=len(comp["indicators"]))
        decision = decisions.get(cid)
        items.append(
            SummaryItem(
                competency_id=cid,
                competency_name=comp["name"],
                rated=suggestion.rated,
                total=suggestion.total,
                no_basis=suggestion.no_basis,
                rated_levels=suggestion.rated_levels,
                suggested_level=suggestion.suggested_level,
                explanation=suggestion.explanation,
                manager_level=decision.level if decision else None,
                justification=decision.justification if decision else None,
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
        ratings=[RatingOut.model_validate(rating) for rating in ratings_for(session, process.id)],
        decisions=[DecisionOut.model_validate(decision) for decision in decisions_for(session, process.id)],
        created_at=process.created_at,
    )


def _indicator_context(rating: Rating) -> dict:
    found = get_competency_model().indicator(rating.indicator_id)
    indicator = found[1] if found else None
    level = indicator["levels"][rating.level - 1] if indicator and rating.level else None
    return {
        "indicator": indicator["name"] if indicator else rating.indicator_id,
        "level": rating.level,
        "level_label": level["label"] if level else None,
        "behaviour": level["description"] if level else None,
        "example": rating.example,
    }


def anonymized_context(session: Session, process: Process) -> dict:
    employee = session.get(Employee, process.employee_id)
    ratings = ratings_for(session, process.id)
    competencies = [
        {
            "competency": item.competency_name,
            "suggested_level": item.suggested_level,
            "manager_level": item.manager_level,
            "justification": item.justification,
            "indicators": [
                _indicator_context(rating) for rating in ratings if rating.competency_id == item.competency_id
            ],
        }
        for item in summary(session, process)
    ]
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
