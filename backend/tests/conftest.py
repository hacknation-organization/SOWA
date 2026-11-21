import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.core import db
from app.seed import DEMO_PASSWORD


@pytest.fixture()
def client():
    import app.models  # noqa: F401

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    db.set_engine(engine)
    from app.main import app

    with TestClient(app) as c:
        yield c
    db.set_engine(None)


@pytest.fixture()
def session(client):
    with Session(db.get_engine()) as s:
        yield s


def login(client: TestClient, username: str) -> dict[str, str]:
    r = client.post("/api/auth/login", json={"username": username, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def manager(client):
    return login(client, "przelozony")


@pytest.fixture()
def hr(client):
    return login(client, "hr")
