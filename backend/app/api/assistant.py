import importlib
import logging

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep, get_process_for_read
from app.schemas import AskRequest, AskResponse
from app.services.processes import anonymized_context

log = logging.getLogger("kompas.assistant")
router = APIRouter(prefix="/assistant", tags=["asystent AI"])

NOT_CONNECTED = AskResponse(
    answer="Asystent AI nie jest jeszcze podłączony (brak modułu app.rag). Spróbuj ponownie później.",
    citations=[],
    confidence="none",
)


def _load_ask():
    try:
        return importlib.import_module("app.rag.service").ask
    except Exception as exc:  # noqa: BLE001
        log.warning("Moduł RAG niedostępny: %s", exc)
        return None


@router.post("/ask", response_model=AskResponse)
async def ask(body: AskRequest, session: SessionDep, user: CurrentUser) -> AskResponse:
    context: dict | None = None
    if body.process_id is not None:
        process = get_process_for_read(session, body.process_id, user)
        if body.mode in ("interview", "plan"):
            context = anonymized_context(session, process)
        else:
            context = {"process_id": process.id, "type": process.type, "form": process.form}

    rag_ask = _load_ask()
    if rag_ask is None:
        return NOT_CONNECTED
    try:
        result = await rag_ask(body.question, body.mode, context)
    except Exception:  # noqa: BLE001
        log.exception("Błąd asystenta RAG")
        return AskResponse(
            answer="Asystent AI jest chwilowo niedostępny. Spróbuj ponownie za chwilę.",
            citations=[],
            confidence="none",
        )
    return AskResponse.model_validate(result)
