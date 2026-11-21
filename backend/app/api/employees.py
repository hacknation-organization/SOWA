from fastapi import APIRouter
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.models import Employee
from app.schemas import EmployeeOut

router = APIRouter(prefix="/employees", tags=["pracownicy"])


@router.get("", response_model=list[EmployeeOut])
def list_employees(session: SessionDep, user: CurrentUser) -> list[Employee]:
    """Przełożony widzi swoich podwładnych; HR i admin – wszystkich."""
    query = select(Employee).order_by(Employee.last_name, Employee.first_name)
    if user.role == "przelozony":
        query = query.where(Employee.manager_id == user.id)
    return list(session.exec(query).all())
