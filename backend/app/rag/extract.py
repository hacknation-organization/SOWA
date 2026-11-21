from __future__ import annotations

import re
import zipfile
from pathlib import Path

from .chunking import (SourceInfo, chunk_competency_model, chunk_form, chunk_guide,
                       chunk_legal_act)

SOURCES: list[tuple[str, SourceInfo]] = [
    ("Pierwsza ocena w służbie cywilnej/Rozporządzenie o pierwszej ocenie z 2015 r. (1).pdf",
     SourceInfo("rozp_pierwsza_2015",
                "Rozporządzenie Prezesa Rady Ministrów z dnia 23 lipca 2015 r. w sprawie szczegółowych "
                "warunków i sposobu dokonywania pierwszej oceny w służbie cywilnej (Dz. U. poz. 1144)",
                "Rozporządzenie o pierwszej ocenie (2015)", "rozporzadzenie", "pierwsza",
                skip_appendices={"2"})),
    ("Ocena okresowa w służbie cywilnej/Rozporządzenie o ocenach okresowych z 2016 r. (3).pdf",
     SourceInfo("rozp_okresowa_2016",
                "Rozporządzenie Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu "
                "przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej "
                "(Dz. U. poz. 470)",
                "Rozporządzenie o ocenach okresowych (2016)", "rozporzadzenie", "okresowa",
                skip_appendices={"3", "4"})),
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


def _squash_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text)


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
            if v and (not cells or cells[-1] != v):
                cells.append(v)
        if cells:
            main_rows.append(cells)
    comps = []
    for ws in sheets[1:]:
        rows = [[("" if c is None else str(c).strip()) for c in row] for row in ws.iter_rows(values_only=True)]
        name = next((r[0] for r in rows if r and r[0]), ws.title)
        hdr_idx = next(i for i, r in enumerate(rows) if r and r[0].lower().startswith("wskaźnik"))
        levels = rows[hdr_idx][1:6]
        inds = [
            {"name": _squash_ws(r[0]), "levels": [_squash_ws(x) for x in r[1:6]]}
            for r in rows[hdr_idx + 1:]
            if r and r[0]
        ]
        comps.append({"name": name, "levels": levels, "indicators": inds})
    return main_rows, comps


def read_docx_blocks(path: Path) -> tuple[list[str], dict[str, str]]:
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
        t = re.sub(r"\(przypis (\d+)\)\s*\)", r"(przypis \1)", t)
        return _squash_ws(t).strip()

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
                    footnotes[fid] = _squash_ws(txt)
    return blocks, footnotes


def build_chunks(docs_root: Path, report: list[str] | None = None) -> list[dict]:
    report = report if report is not None else []
    chunks: list[dict] = []
    for rel, src in SOURCES:
        path = docs_root / rel
        if not path.exists():
            report.append(f"BRAK PLIKU: {rel}")
            continue
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            pages = read_pdf_pages(path)
            if not pdf_has_text_layer(pages):
                report.append(f"UWAGA: {rel} wygląda na skan bez warstwy tekstu – pominięto (wymaga OCR)")
                continue
            chunker = chunk_legal_act if src.doc_type == "rozporzadzenie" else chunk_guide
            source_chunks = chunker(src, pages)
        elif suffix == ".xlsx":
            source_chunks = chunk_competency_model(src, *read_competency_model(path))
        elif suffix == ".docx":
            source_chunks = chunk_form(src, *read_docx_blocks(path))
        else:
            continue
        report.append(f"{src.source_id}: {len(source_chunks)} chunków ({rel})")
        chunks.extend(source_chunks)
    return chunks
