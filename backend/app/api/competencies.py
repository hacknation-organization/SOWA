from fastapi import APIRouter, HTTPException, status

from app.domain.competency_model import get_competency_model
from app.schemas import CompetencyOut

router = APIRouter(prefix="/competencies", tags=["model kompetencji"])


@router.get("", response_model=list[CompetencyOut])
def list_competencies() -> list[dict]:
    return get_competency_model().competencies


@router.get("/{competency_id}", response_model=CompetencyOut)
def get_competency(competency_id: str) -> dict:
    comp = get_competency_model().competency(competency_id)
    if comp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nieznana kompetencja")
    return comp
