"""Etapy procesu oceny i reguły walidacji."""

STAGES = ["job_description", "criteria", "assessment", "summary", "interview", "document"]
STAGE_LABELS = {
    "job_description": "Opis stanowiska pracy",
    "criteria": "Wybór kryteriów",
    "assessment": "Ocena wskaźników",
    "summary": "Podsumowanie i decyzje",
    "interview": "Rozmowa oceniająca",
    "document": "Dokument",
}
PROCESS_TYPES = {"first": "Pierwsza ocena", "periodic": "Ocena okresowa"}
FORMS = {"B", "C"}
STATUSES = {"in_progress": "W toku", "completed": "Zakończony"}


def validate_type_form(type_: str, form: str | None) -> str | None:
    """Zwraca komunikat błędu albo None."""
    if type_ not in PROCESS_TYPES:
        return "type musi być 'first' albo 'periodic'"
    if type_ == "first" and form is not None:
        return "Pierwsza ocena nie używa arkusza B/C (form musi być null)"
    if type_ == "periodic" and form not in FORMS:
        return "Ocena okresowa wymaga arkusza 'B' lub 'C'"
    return None
