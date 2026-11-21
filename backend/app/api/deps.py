from collections.abc import Callable
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.core.db import get_session
from app.core.security import decode_access_token
from app.models import Process, User

SessionDep = Annotated[Session, Depends(get_session)]
_bearer = HTTPBearer(auto_error=False, description="Token JWT z POST /api/auth/login")


def get_current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Brak tokenu", headers={"WWW-Authenticate": "Bearer"}
        )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Nieprawidłowy lub wygasły token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Użytkownik nie istnieje")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: str) -> Callable[[User], User]:
    def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Wymagana rola: {', '.join(roles)}")
        return user

    return checker


def _get_process_or_404(session: Session, process_id: int) -> Process:
    process = session.get(Process, process_id)
    if process is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proces nie istnieje")
    return process


def get_process_for_read(session: Session, process_id: int, user: User) -> Process:
    process = _get_process_or_404(session, process_id)
    if user.role in ("hr", "admin") or process.manager_id == user.id:
        return process
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Brak dostępu do procesu")


def get_process_for_write(session: Session, process_id: int, user: User) -> Process:
    process = _get_process_or_404(session, process_id)
    if user.role == "admin" or process.manager_id == user.id:
        return process
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Tylko przełożony prowadzący ocenę może ją edytować")
