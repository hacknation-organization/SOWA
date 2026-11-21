"""Dostęp do modelu kompetencji (backend/data/competency_model.json)."""

import json
from functools import lru_cache

from app.core.config import get_settings


class CompetencyModel:
    def __init__(self, data: dict):
        self.data = data
        self.competencies: list[dict] = data["competencies"]
        self.by_id = {c["id"]: c for c in self.competencies}
        self.indicator_index: dict[str, tuple[dict, dict]] = {
            ind["id"]: (comp, ind) for comp in self.competencies for ind in comp["indicators"]
        }

    def competency(self, competency_id: str) -> dict | None:
        return self.by_id.get(competency_id)

    def indicator(self, indicator_id: str) -> tuple[dict, dict] | None:
        return self.indicator_index.get(indicator_id)


@lru_cache
def get_competency_model() -> CompetencyModel:
    path = get_settings().competency_model_path
    return CompetencyModel(json.loads(path.read_text(encoding="utf-8")))
