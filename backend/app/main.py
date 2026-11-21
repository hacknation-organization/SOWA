import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from app.api import assistant, auth, competencies, employees, hr, processes
from app.core.config import get_settings
from app.core.db import get_engine, init_db
from app.seed import seed_demo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if get_settings().seed_demo_data:
        with Session(get_engine()) as session:
            if seed_demo(session):
                logging.getLogger("kompas").info("Załadowano dane demo")
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description=(
            "API wspierające przełożonych w służbie cywilnej w pierwszej ocenie i ocenie okresowej "
            "(arkusze B/C) na podstawie modelu kompetencji. Sugerowany poziom liczy deterministyczny kod "
            "(mediana); decyzję zawsze podejmuje przełożony."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )

    api = APIRouter(prefix="/api")

    @api.get("/health", tags=["system"])
    def health() -> dict:
        return {"status": "ok"}

    for module in (auth, competencies, employees, processes, hr, assistant):
        api.include_router(module.router)
    app.include_router(api)
    return app


app = create_app()
