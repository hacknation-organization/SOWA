from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

BACKEND_DIR = Path(__file__).resolve().parents[1]
OUTPUT = BACKEND_DIR / "data" / "competency_model.json"
LEVEL_LABELS = [
    "Znacznie poniżej oczekiwań",
    "Poniżej oczekiwań",
    "Na poziomie oczekiwań",
    "Powyżej oczekiwań",
    "Znacznie powyżej oczekiwań",
]
EXPECTED_COMPETENCIES = 14
EXPECTED_INDICATORS = 49


def clean(text: object) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def slugify(text: str) -> str:
    text = text.replace("ł", "l").replace("Ł", "L")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def find_default_xlsx() -> Path:
    for parent in [BACKEND_DIR, *BACKEND_DIR.parents]:
        candidate = parent / "docs" / "HackNation" / "Model_kompetencji.xlsx"
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        "Nie znaleziono docs/HackNation/Model_kompetencji.xlsx – podaj ścieżkę jako argument."
    )


def parse(xlsx: Path) -> dict:
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    index_ws = wb.worksheets[0]

    index: list[tuple[int, str, int]] = []
    for row in index_ws.iter_rows(values_only=True):
        if row and row[0] is not None and str(row[0]).strip().isdigit() and row[1]:
            index.append((int(str(row[0]).strip()), clean(row[1]), int(str(row[2]).strip())))

    sheets = wb.worksheets[1:]
    if len(sheets) != len(index):
        raise ValueError(f"Spis ma {len(index)} pozycji, a arkuszy kompetencji jest {len(sheets)}")

    competencies = []
    for (lp, name, expected_count), ws in zip(index, sheets, strict=True):
        indicators = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or not clean(row[0]) or not any(row[1:6]):
                continue
            if clean(row[0]).lower().startswith("wskaźnik behawioralny"):
                continue
            descriptions = [clean(c) for c in row[1:6]]
            if len(descriptions) != 5 or not all(descriptions):
                raise ValueError(
                    f"Arkusz {ws.title}: niekompletne opisy poziomów dla wskaźnika {clean(row[0])!r}"
                )
            idx = len(indicators) + 1
            indicators.append(
                {
                    "id": f"K{lp:02d}-W{idx}",
                    "name": clean(row[0]),
                    "levels": [
                        {"level": lvl, "label": LEVEL_LABELS[lvl - 1], "description": descriptions[lvl - 1]}
                        for lvl in range(1, 6)
                    ],
                }
            )
        if len(indicators) != expected_count:
            raise ValueError(
                f"{name}: spis podaje {expected_count} wskaźników, w arkuszu jest {len(indicators)}"
            )
        competencies.append(
            {"id": f"K{lp:02d}", "slug": slugify(name), "name": name, "indicators": indicators}
        )

    return {
        "source": xlsx.name,
        "levels": [{"level": i + 1, "label": label} for i, label in enumerate(LEVEL_LABELS)],
        "competencies": competencies,
    }


def main() -> None:
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else find_default_xlsx()
    model = parse(xlsx)
    n_comp = len(model["competencies"])
    n_ind = sum(len(c["indicators"]) for c in model["competencies"])
    if (n_comp, n_ind) != (EXPECTED_COMPETENCIES, EXPECTED_INDICATORS):
        raise SystemExit(f"Nieoczekiwane liczby: {n_comp} kompetencji, {n_ind} wskaźników")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(model, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK: {n_comp} kompetencji, {n_ind} wskaźników -> {OUTPUT}")


if __name__ == "__main__":
    main()
