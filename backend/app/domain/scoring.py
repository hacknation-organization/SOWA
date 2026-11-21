from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field

LEVEL_LABELS = {
    1: "Znacznie poniżej oczekiwań",
    2: "Poniżej oczekiwań",
    3: "Na poziomie oczekiwań",
    4: "Powyżej oczekiwań",
    5: "Znacznie powyżej oczekiwań",
}


@dataclass(frozen=True)
class Suggestion:
    suggested_level: int | None
    rated_levels: list[int] = field(default_factory=list)
    rated: int = 0
    no_basis: int = 0
    total: int = 0
    explanation: str = ""


def lower_median(values: Iterable[int]) -> int | None:
    ordered = sorted(values)
    if not ordered:
        return None
    return ordered[(len(ordered) - 1) // 2]


def suggest_level(levels: list[int | None], total: int | None = None) -> Suggestion:
    for lvl in levels:
        if lvl is not None and lvl not in LEVEL_LABELS:
            raise ValueError(f"Nieprawidłowy poziom: {lvl!r}")
    total = len(levels) if total is None else total
    rated = sorted(lvl for lvl in levels if lvl is not None)
    no_basis = sum(1 for lvl in levels if lvl is None)
    pending = max(total - len(levels), 0)
    suggested = lower_median(rated)

    if suggested is None:
        explanation = "Brak ocenionych wskaźników – nie można wyliczyć sugerowanego poziomu."
    else:
        explanation = (
            f"Mediana z {len(rated)} ocenionych wskaźników (poziomy: {', '.join(map(str, rated))}) "
            f"= {suggested} ({LEVEL_LABELS[suggested]})."
        )
        if len(rated) % 2 == 0 and rated[len(rated) // 2 - 1] != rated[len(rated) // 2]:
            explanation += " Przy remisie wybrano niższą wartość."
    if no_basis:
        explanation += f" Pominięto {no_basis} wskaźn. z brakiem podstaw do oceny."
    if pending:
        explanation += f" Nie oceniono jeszcze {pending} wskaźn."

    return Suggestion(
        suggested_level=suggested,
        rated_levels=rated,
        rated=len(rated),
        no_basis=no_basis,
        total=total,
        explanation=explanation,
    )
