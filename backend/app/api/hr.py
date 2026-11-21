import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.api.deps import SessionDep, require_roles
from app.models import Employee, Process, Reminder, User
from app.schemas import HrProcessItem, ReminderOut, ReminderRequest, ReminderResponse
from app.services import processes as svc

log = logging.getLogger("kompas.reminders")
router = APIRouter(prefix="/hr", tags=["HR"])
HrUser = Annotated[User, Depends(require_roles("hr", "admin"))]


def _last_reminder_at(session: Session, process_id: int) -> datetime | None:
    reminder = session.exec(
        select(Reminder).where(Reminder.process_id == process_id).order_by(Reminder.created_at.desc())
    ).first()
    return reminder.created_at if reminder else None


@router.get("/processes", response_model=list[HrProcessItem])
def hr_processes(
    session: SessionDep,
    _: HrUser,
    status_: Annotated[
        str | None, Query(alias="status", description="in_progress | completed | overdue")
    ] = None,
    unit: str | None = None,
    type_: Annotated[str | None, Query(alias="type", description="first | periodic")] = None,
) -> list[HrProcessItem]:
    query = (
        select(Process, Employee, User)
        .join(Employee, Process.employee_id == Employee.id)
        .join(User, Process.manager_id == User.id)
    )
    if status_ and status_ != "overdue":
        query = query.where(Process.status == status_)
    if unit:
        query = query.where(Employee.unit == unit)
    if type_:
        query = query.where(Process.type == type_)
    items = []
    for process, employee, manager in session.exec(query.order_by(Process.deadline)).all():
        overdue = svc.is_overdue(process)
        if status_ == "overdue" and not overdue:
            continue
        items.append(
            HrProcessItem(
                id=process.id,
                employee_name=f"{employee.first_name} {employee.last_name}",
                position=employee.position,
                unit=employee.unit,
                manager_name=manager.display_name,
                type=process.type,
                form=process.form,
                stage=process.stage,
                status=process.status,
                deadline=process.deadline,
                overdue=overdue,
                progress=svc.progress(session, process.id),
                last_reminder_at=_last_reminder_at(session, process.id),
            )
        )
    return items


@router.post("/reminders", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
def send_reminders(body: ReminderRequest, session: SessionDep, user: HrUser) -> ReminderResponse:
    created = []
    for pid in dict.fromkeys(body.process_ids):
        process = session.get(Process, pid)
        if process is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Proces {pid} nie istnieje")
        deadline = process.deadline.isoformat() if process.deadline else "brak terminu"
        message = (
            body.message or f"Przypomnienie: proces oceny nr {pid} (termin: {deadline}) wymaga dokończenia."
        )
        reminder = Reminder(process_id=pid, sent_by=user.id, recipient_id=process.manager_id, message=message)
        session.add(reminder)
        created.append(reminder)
        log.info("Przypomnienie dla użytkownika %s, proces %s: %s", process.manager_id, pid, message)
    session.commit()
    for reminder in created:
        session.refresh(reminder)
    return ReminderResponse(
        created=len(created), reminders=[ReminderOut.model_validate(reminder) for reminder in created]
    )


@router.get("/units", response_model=list[str])
def units(session: SessionDep, _: HrUser) -> list[str]:
    return sorted(set(session.exec(select(Employee.unit)).all()))
