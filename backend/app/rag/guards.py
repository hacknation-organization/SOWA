"""Zabezpieczenia: prośby o decyzję oceniającą, prompt injection, minimalizacja danych w kontekście."""

from __future__ import annotations

import copy
import json
import re

from .textutil import fold

NO_INFO_ANSWER = "W bazie wiedzy nie znalazłem informacji na ten temat."

DECISION_REFUSAL = (
    "Nie mogę wskazać ani zasugerować poziomu oceny, oceny cząstkowej ani wyniku oceny konkretnego "
    "pracownika – tę decyzję zawsze podejmuje przełożony (oceniający). Mogę natomiast wyjaśnić zasady "
    "i skalę ocen, przypomnieć opisy zachowań na poszczególnych poziomach w modelu kompetencji albo pomóc "
    "uporządkować obserwacje i przygotować rozmowę oceniającą."
)

# Prośby o rozstrzygnięcie oceny konkretnej osoby. Dopasowanie na tekście bez diakrytyków.
_ACT = r"(dac|dam|wystawic|wystawie|przyznac|przyznam|postawic|postawie|wpisac|wpisze|zaznaczyc|zaznacze|wybrac|wybiore)"
_DECISION_PATTERNS = [
    r"\b(jak\w*|ktor\w*|co|ile)\b.{0,40}\b(ocen\w*|poziom\w*|punkt\w*)\b.{0,40}\b" + _ACT + r"\b",
    r"\b" + _ACT + r"\b.{0,40}\b(mu|jej|pracownik\w*|podwladn\w*|kandydat\w*|temu|tej osobie)\b",
    r"\b(przyznaj|wystaw|postaw|zdecyduj|rozstrzygnij)\b.{0,50}\b(pracownik\w*|podwladn\w*|ocen\w*|poziom\w*|jego|ja|go)\b",
    r"\bocen\b (go|ja|tego|te|moj\w*|pracownik\w*|podwladn\w*)\b",
    r"\bczy\b.{0,60}\b(zasluguje|zasluzyl\w*|powinien dostac|powinna dostac|powinien otrzymac|powinna otrzymac|kwalifikuje sie)\b",
    r"\b(zasugeruj|zaproponuj|podpowiedz|wskaz|powiedz)\b.{0,40}\b(ocen\w*|poziom\w*|punkt\w*)\b.{0,40}\b(dla|mu|jej|pracownik\w*|podwladn\w*|przyzna\w*|dac|wystaw\w*)\b",
    r"\b(jak\w*|ktor\w*)\b.{0,30}\b(ocen\w*|poziom\w*)\b.{0,30}\b(powinien|powinna|powinno|nalezy sie|mam)\b",
]
_DECISION_RE = [re.compile(p) for p in _DECISION_PATTERNS]

# Prośby, które dotyczą zasad (a nie konkretnej osoby) – nie blokujemy ich.
_RULES_HINT = re.compile(r"\b(warunk\w*|zasad\w*|kiedy przyznaje sie|w jakich przypadkach|skal\w*|jak sie liczy|kto przyznaje)\b")


def is_decision_request(question: str) -> bool:
    q = fold(question)
    if _RULES_HINT.search(q) and not re.search(r"\b(moj\w*|temu|tej osob\w*|kowalsk\w*|nowak\w*|mu|jej)\b", q):
        return False
    return any(r.search(q) for r in _DECISION_RE)


_INJECTION = re.compile(
    r"(zignoruj|ignoruj|pomin|zapomnij)\b.{0,40}\b(instrukcj|polecen|zasad|regul)|"
    r"ignore (all |the )?(previous|prior|above) (instructions|rules)|"
    r"(jestes teraz|you are now|tryb (administratora|dewelopera|developer))|system prompt|prompt systemow",
)


def looks_like_injection(text: str) -> bool:
    return bool(_INJECTION.search(fold(text)))


def neutralize(text: str) -> str:
    """Usuwa z danych znaczniki, którymi oddzielamy sekcje promptu (dane nie mogą „zamknąć” sekcji)."""
    return re.sub(r"</?\s*(fragment|fragmenty|dane_oceny|pytanie|system|instrukcje)[^>]*>", "", text, flags=re.I)


# -- minimalizacja danych osobowych w kontekście trybu „interview” ----------------

_PII_KEYS = {
    "imie", "imię", "nazwisko", "first_name", "last_name", "firstname", "lastname", "full_name", "fullname",
    "name_of_employee", "employee_name", "pracownik_imie", "pesel", "email", "e-mail", "mail", "telefon",
    "phone", "adres", "address", "data_urodzenia", "birth_date", "nr_ewidencyjny", "employee_id",
    "evaluator_name", "przelozony", "przełożony", "oceniajacy_imie",
}
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_PESEL = re.compile(r"\b\d{11}\b")
_PHONE = re.compile(r"(?<!\d)(\+?48[ -]?)?\d{3}[ -]?\d{3}[ -]?\d{3}(?!\d)")


def scrub_context(context: dict | None, max_chars: int = 12000) -> dict | None:
    """Usuwa klucze z danymi identyfikującymi i maskuje e-maile/PESEL/telefony; ogranicza rozmiar."""
    if not context:
        return None

    def walk(x):
        if isinstance(x, dict):
            return {k: walk(v) for k, v in x.items() if fold(str(k)) not in {fold(p) for p in _PII_KEYS}}
        if isinstance(x, list):
            return [walk(v) for v in x]
        if isinstance(x, str):
            s = _EMAIL.sub("[e-mail]", x)
            s = _PESEL.sub("[numer]", s)
            s = _PHONE.sub("[telefon]", s)
            return neutralize(s)[:2000]
        return x

    clean = walk(copy.deepcopy(context))
    raw = json.dumps(clean, ensure_ascii=False)
    if len(raw) > max_chars:
        clean = {"_uwaga": "kontekst skrócony", "dane": raw[:max_chars]}
    return clean


def context_terms(context: dict | None) -> str:
    """Nazwy kompetencji / wskaźników / zachowań z kontekstu – do wzbogacenia zapytania wyszukiwania."""
    if not context:
        return ""
    out: list[str] = []

    def walk(x, key=""):
        if isinstance(x, dict):
            for k, v in x.items():
                walk(v, str(k))
        elif isinstance(x, list):
            for v in x:
                walk(v, key)
        elif isinstance(x, str) and fold(key) in {"name", "nazwa", "kompetencja", "competency", "indicator",
                                                   "wskaznik", "criterion", "kryterium"}:
            out.append(x)

    walk(context)
    return " ".join(dict.fromkeys(out))


def competency_names(context: dict | None) -> list[str]:
    if not context:
        return []
    comps = context.get("competencies") or context.get("kompetencje") or []
    names = []
    for c in comps if isinstance(comps, list) else []:
        if isinstance(c, dict):
            n = c.get("name") or c.get("nazwa") or c.get("kompetencja")
            if n:
                names.append(str(n))
        elif isinstance(c, str):
            names.append(c)
    return names
