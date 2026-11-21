"""Ekstrakcja tekstu z plików korpusu (PDF, XLSX, DOCX) i rejestr źródeł."""

from __future__ import annotations

import re
import zipfile
from pathlib import Path

from .chunking import (SourceInfo, chunk_competency_model, chunk_form, chunk_guide,
                       chunk_legal_act)

# Rejestr źródeł: ścieżka względem katalogu docs/HackNation -> metadane.
# Rozporządzenie o ocenach okresowych występuje w paczce dwukrotnie: kopia „(3)” to pełny akt
# (19 stron), kopia „(4)” (folder OSP) to tylko 3-stronicowy wyciąg z załącznika nr 1
# z nakładką znaku wodnego – nie jest indeksowana, bo jej treść zawiera się w kopii „(3)”.
SOURCES: list[tuple[str, SourceInfo]] = [
    ("Pierwsza ocena w służbie cywilnej/Rozporządzenie o pierwszej ocenie z 2015 r. (1).pdf",
     SourceInfo("rozp_pierwsza_2015",
                "Rozporządzenie Prezesa Rady Ministrów z dnia 23 lipca 2015 r. w sprawie szczegółowych "
                "warunków i sposobu dokonywania pierwszej oceny w służbie cywilnej (Dz. U. poz. 1144)",
                "Rozporządzenie o pierwszej ocenie (2015)", "rozporzadzenie", "pierwsza",
                skip_appendices={"2"})),  # zał. 2 = arkusz pierwszej oceny – indeksowany z .docx
    ("Ocena okresowa w służbie cywilnej/Rozporządzenie o ocenach okresowych z 2016 r. (3).pdf",
     SourceInfo("rozp_okresowa_2016",
                "Rozporządzenie Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu "
                "przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej "
                "(Dz. U. poz. 470)",
                "Rozporządzenie o ocenach okresowych (2016)", "rozporzadzenie", "okresowa",
                skip_appendices={"3", "4"})),  # zał. 3–4 = arkusze B i C – indeksowane z .docx
    ("Pierwsza ocena w służbie cywilnej/Pierwsza ocena w służbie cywilnej - poradnik z 2016 r. (1).pdf",
     SourceInfo("poradnik_pierwsza_2016",
                "Poradnik KPRM „Pierwsza ocena w służbie cywilnej” (Departament Służby Cywilnej, wrzesień 2016)",
                "Poradnik: Pierwsza ocena w SC (2016)", "poradnik", "pierwsza")),
    ("Ocena okresowa w służbie cywilnej/Poradnik - oceny okresowe w służbie cywilnej (2).pdf",
     SourceInfo("poradnik_okresowa_2016",
                "Poradnik KPRM „Oceny okresowe w służbie cywilnej” (Departament Służby Cywilnej, wrzesień 2016)",
                "Poradnik: Oceny okresowe w SC (2016)", "poradnik", "okresowa")),
    ("Model_kompetencji.xlsx",
     SourceInfo("model_kompetencji", "Model kompetencji – służba cywilna (Model_kompetencji.xlsx)",
                "Model kompetencji", "model", "oba")),
    ("Pierwsza ocena w służbie cywilnej/Arkusz pierwszej oceny (2).docx",
     SourceInfo("arkusz_pierwsza", "Wzór arkusza pierwszej oceny w służbie cywilnej (zał. nr 2 do rozporządzenia z 2015 r.)",
                "Arkusz pierwszej oceny", "formularz", "pierwsza")),
    ("Ocena okresowa w służbie cywilnej/Arkusz oceny B (2).docx",
     SourceInfo("arkusz_B", "Wzór arkusza oceny okresowej B (zał. nr 3 do rozporządzenia z 2016 r.)",
                "Arkusz oceny okresowej B", "formularz", "okresowa")),
    ("Ocena okresowa w służbie cywilnej/Arkusz oceny C (2).docx",
     SourceInfo("arkusz_C", "Wzór arkusza oceny okresowej C (zał. nr 4 do rozporządzenia z 2016 r.)",
                "Arkusz oceny okresowej C", "formularz", "okresowa")),
]


def read_pdf_pages(path: Path) -> list[tuple[int, str]]:
    import pdfplumber

    with pdfplumber.open(str(path)) as pdf:
        return [(i, page.extract_text() or "") for i, page in enumerate(pdf.pages, 1)]


def pdf_has_text_layer(pages: list[tuple[int, str]], min_chars_per_page: int = 200) -> bool:
    total = sum(len(t) for _, t in pages)
    return bool(pages) and total / len(pages) >= min_chars_per_page


def read_competency_model(path: Path) -> tuple[list[list[str]], list[dict]]:
    import openpyxl

    wb = openpyxl.load_workbook(str(path), data_only=True, read_only=True)
    sheets = wb.worksheets
    main_rows = []
    for row in sheets[0].iter_rows(values_only=True):
        cells: list[str] = []
        for c in row:
            v = "" if c is None else str(c).strip()
            if v and (not cells or cells[-1] != v):  # komórki scalone powtarzają wartość
                cells.append(v)
        if cells:
            main_rows.append(cells)
    comps = []
    for ws in sheets[1:]:
        rows = [[("" if c is None else str(c).strip()) for c in row] for row in ws.iter_rows(values_only=True)]
        name = next((r[0] for r in rows if r and r[0]), ws.title)
        hdr_idx = next(i for i, r in enumerate(rows) if r and r[0].lower().startswith("wskaźnik"))
        levels = [x for x in rows[hdr_idx][1:6]]
        inds = []
        for r in rows[hdr_idx + 1:]:
            if r and r[0]:
                inds.append({"name": re.sub(r"\s+", " ", r[0]), "levels": [re.sub(r"\s+", " ", x) for x in r[1:6]]})
        comps.append({"name": name, "levels": levels, "indicators": inds})
    return main_rows, comps


def read_docx_blocks(path: Path) -> tuple[list[str], dict[str, str]]:
    """Zwraca akapity i wiersze tabel w kolejności dokumentu (wiersz = komórki rozdzielone „ | ”)
    oraz treść przypisów; odwołania do przypisów zastępowane są znacznikiem „(przypis N)”."""
    import docx
    from docx.oxml.ns import qn

    def run_text(el) -> str:
        parts = []
        for x in el.iter():
            if x.tag == qn("w:t"):
                parts.append(x.text or "")
            elif x.tag == qn("w:footnoteReference"):
                parts.append(f" (przypis {x.get(qn('w:id'))})")
        t = "".join(parts)
        t = re.sub(r"\(przypis (\d+)\)\s*\)", r"(przypis \1)", t)  # „Stanowisko pracy(przypis 2))” -> bez „)”
        return re.sub(r"\s+", " ", t).strip()

    d = docx.Document(str(path))
    blocks: list[str] = []
    for el in d.element.body.iterchildren():
        if el.tag == qn("w:p"):
            t = run_text(el)
            if t:
                blocks.append(t)
        elif el.tag == qn("w:tbl"):
            for row in el.iter(qn("w:tr")):
                cells: list[str] = []
                for c in row.iter(qn("w:tc")):
                    ct = " ".join(run_text(p) for p in c.iter(qn("w:p"))).strip()
                    if ct and not re.fullmatch(r"[.…\s]+", ct) and (not cells or cells[-1] != ct):
                        cells.append(ct)
                if cells:
                    blocks.append(" | ".join(cells))

    footnotes: dict[str, str] = {}
    with zipfile.ZipFile(str(path)) as z:
        if "word/footnotes.xml" in z.namelist():
            xml = z.read("word/footnotes.xml").decode("utf-8")
            for fid, body in re.findall(r'<w:footnote\b[^>]*w:id="(\d+)"[^>]*>(.*?)</w:footnote>', xml, re.S):
                txt = "".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", body)).strip()
                txt = re.sub(r"^\)\s*", "", txt)
                if txt:
                    footnotes[fid] = re.sub(r"\s+", " ", txt)
    return blocks, footnotes


def build_chunks(docs_root: Path, report: list[str] | None = None) -> list[dict]:
    report = report if report is not None else []
    chunks: list[dict] = []
    for rel, src in SOURCES:
        path = docs_root / rel
        if not path.exists():
            report.append(f"BRAK PLIKU: {rel}")
            continue
        if path.suffix.lower() == ".pdf":
            pages = read_pdf_pages(path)
            if not pdf_has_text_layer(pages):
                report.append(f"UWAGA: {rel} wygląda na skan bez warstwy tekstu – pominięto (wymaga OCR)")
                continue
            if src.doc_type == "rozporzadzenie":
                cs = chunk_legal_act(src, pages)
            else:
                cs = chunk_guide(src, pages)
        elif path.suffix.lower() == ".xlsx":
            main_rows, comps = read_competency_model(path)
            cs = chunk_competency_model(src, main_rows, comps)
        elif path.suffix.lower() == ".docx":
            blocks, notes = read_docx_blocks(path)
            cs = chunk_form(src, blocks, notes)
        else:
            continue
        report.append(f"{src.source_id}: {len(cs)} chunków ({rel})")
        chunks.extend(cs)
    return chunks
