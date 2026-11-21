from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.core.security import create_access_token, verify_password
from app.models import User
from app.schemas import LoginRequest, LoginResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, session: SessionDep) -> LoginResponse:
    user = session.exec(select(User).where(User.username == body.username)).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Nieprawidłowy login lub hasło")
    return LoginResponse(
        access_token=create_access_token(user.id, user.role), role=user.role, display_name=user.display_name
    )


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user
