STAGES = ["job_description", "criteria", "assessment", "summary", "interview", "document"]
PROCESS_TYPES = {"first", "periodic"}
FORMS = {"B", "C"}


def validate_type_form(type_: str, form: str | None, stage: str = "job_description") -> str | None:
    """Arkusz B/C wybiera się na etapie opisu stanowiska – wymagany dopiero przy przejściu dalej."""
    if type_ not in PROCESS_TYPES:
        return "type musi być 'first' albo 'periodic'"
    if type_ == "first" and form is not None:
        return "Pierwsza ocena nie używa arkusza B/C (form musi być null)"
    if type_ == "periodic" and form is not None and form not in FORMS:
        return "Ocena okresowa wymaga arkusza 'B' lub 'C'"
    if type_ == "periodic" and form is None and stage != "job_description":
        return "Ocena okresowa wymaga arkusza 'B' lub 'C'"
    return None
