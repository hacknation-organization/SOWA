from collections.abc import Iterator
from typing import Any

from sqlalchemy import Engine, make_url
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings

_engine: Engine | None = None

# Supabase transaction pooler (Supavisor) listens on 6543 and does not support prepared statements.
SUPABASE_TRANSACTION_POOLER_PORT = 6543


def build_engine(url: str) -> Engine:
    parsed = make_url(url)
    connect_args: dict[str, Any] = {}
    engine_kwargs: dict[str, Any] = {}
    if parsed.get_backend_name() == "sqlite":
        connect_args["check_same_thread"] = False
    else:
        # Remote Postgres (e.g. Supabase): drop stale pooled connections and keep the pool small,
        # the pooler already multiplexes connections on its side.
        engine_kwargs.update(pool_pre_ping=True, pool_size=5, max_overflow=5, pool_recycle=300)
        if parsed.port == SUPABASE_TRANSACTION_POOLER_PORT:
            connect_args["prepare_threshold"] = None
    return create_engine(url, connect_args=connect_args, **engine_kwargs)


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = build_engine(get_settings().database_url)
    return _engine


def set_engine(engine: Engine | None) -> None:
    global _engine
    _engine = engine


def init_db() -> None:
    import app.models  # noqa: F401

    SQLModel.metadata.create_all(get_engine())


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
