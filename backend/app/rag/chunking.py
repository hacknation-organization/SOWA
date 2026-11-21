"""Strukturalne chunkowanie korpusu.

Każdy chunk to słownik:
    id, source, source_id, doc_type, path, page, applies_to, text

``text`` zawiera prefiks ścieżki (np. ``[Rozporządzenie ... | § 5 ust. 2]``), dzięki czemu zarówno
BM25, jak i embeddingi „widzą” kontekst fragmentu, a LLM może wskazać źródło.

Funkcje są czyste (operują na tekście / strukturach), ekstrakcja z plików jest w ``extract.py``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .textutil import approx_tokens, clean_ws, dehyphenate, fold, split_sentences

TARGET_TOKENS = 450
MAX_TOKENS = 600
MIN_TOKENS = 80


@dataclass
class SourceInfo:
    source_id: str
    title: str  # pełna, czytelna nazwa źródła – trafia do cytatu
    short: str  # krótka nazwa do prefiksu chunka
    doc_type: str  # rozporzadzenie | poradnik | model | formularz | qa
    applies_to: str  # pierwsza | okresowa | oba
    skip_appendices: set[str] = field(default_factory=set)


@dataclass
class Line:
    text: str
    page: int | None


def make_chunk(src: SourceInfo, path: str, body: str, page: int | None, n: int,
               applies_to: str | None = None) -> dict:
    body = clean_ws(body)
    return {
        "id": f"{src.source_id}#{n:03d}",
        "source": src.title,
        "source_id": src.source_id,
        "doc_type": src.doc_type,
        "path": path,
        "page": page,
        "applies_to": applies_to or src.applies_to,
        "text": f"[{src.short} | {path}]\n{body}",
    }


def chunk_body(chunk: dict) -> str:
    """Treść chunka bez prefiksu ścieżki."""
    text = chunk["text"]
    if text.startswith("[") and "]\n" in text:
        return text.split("]\n", 1)[1]
    return text


# ---------------------------------------------------------------------------
# Pakowanie zdań w okna o zadanej długości
# ---------------------------------------------------------------------------

def pack_sentences(sentences: list[str], target: int = TARGET_TOKENS, max_tokens: int = MAX_TOKENS,
                   overlap: int = 1) -> list[str]:
    windows: list[str] = []
    cur: list[str] = []
    cur_tok = 0
    for s in sentences:
        st = approx_tokens(s)
        if cur and (cur_tok + st > max_tokens or cur_tok >= target):
            windows.append(" ".join(cur))
            cur = cur[-overlap:] if overlap else []
            cur_tok = sum(approx_tokens(x) for x in cur)
        cur.append(s)
        cur_tok += st
    if cur:
        tail = " ".join(cur)
        # bardzo krótki ogon dołączamy do poprzedniego okna
        if windows and approx_tokens(tail) < MIN_TOKENS and approx_tokens(windows[-1]) + approx_tokens(tail) <= max_tokens + 100:
            windows[-1] = windows[-1] + " " + " ".join(cur[overlap:] if overlap else cur)
        elif not windows or tail != windows[-1]:
            windows.append(tail)
    return windows


def _lines_to_prose(lines: list[str]) -> str:
    """Łączy linie z PDF w akapity, zachowując punktory i wyliczenia w osobnych liniach."""
    out: list[str] = []
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        starts_item = bool(re.match(r"^([•\-−–]|\d+\)|[a-z]\)|\d+\.\s|§)", ln))
        if out and not starts_item and not out[-1].endswith((":",)):
            out[-1] = out[-1] + "\n" + ln
        else:
            out.append(ln)
    text = "\n".join(out)
    text = dehyphenate(text)
    # zwykłe złamania linii wewnątrz zdań -> spacja
    text = re.sub(r"(?<![.:;])\n(?![•\-−–]|\d+\)|[a-z]\)|\d+\.\s|§)", " ", text)
    return text


# ---------------------------------------------------------------------------
# Akty prawne
# ---------------------------------------------------------------------------

_DU_HEADER = re.compile(r"^Dziennik Ustaw\s*[–-]\s*\d+\s*[–-].*Poz\.\s*\d+\s*$")
_PAR = re.compile(r"^§\s*(\d+[a-z]?)\.\s*(.*)$")
_UST = re.compile(r"^(\d+)\.\s+(.*)$")
_APPX = re.compile(r"^Załącznik nr (\d+)\s*$")
_ITEM = re.compile(r"^(\d+)\.\s+([A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ /]{2,})")
_NOISE = re.compile(r"^(Załączniki|do rozporządzenia|Prezesa Rady Ministrów|z dnia( …)?|\(poz\. …\)|WZÓR|"
                    r"Załączniki do rozpo.*|z dnia \d+ \w+ \d{4} r\. \(poz\. \d+\)|.*Dziennik Ustaw.*Poz\..*)\s*$")


def _clean_legal_lines(pages: list[tuple[int, str]]) -> list[Line]:
    lines: list[Line] = []
    for page_no, text in pages:
        for raw in (text or "").splitlines():
            s = raw.strip()
            if not s or _DU_HEADER.match(s):
                continue
            lines.append(Line(s, page_no))
    return lines


def _legal_units(body: list[Line]) -> list[tuple[str, list[Line]]]:
    """Dzieli treść aktu na jednostki § (i preambułę)."""
    units: list[tuple[str, list[Line]]] = []
    cur_label = "preambuła"
    cur: list[Line] = []
    for ln in body:
        m = _PAR.match(ln.text)
        if m:
            if cur:
                units.append((cur_label, cur))
            cur_label = f"§ {m.group(1)}"
            cur = [ln]
        else:
            cur.append(ln)
    if cur:
        units.append((cur_label, cur))
    return units


def _split_ust(par_label: str, lines: list[Line]) -> list[tuple[str, list[Line]]]:
    """Dzieli § na ustępy; pierwszy ustęp jest w linii „§ N. 1. ...”."""
    groups: list[tuple[int, list[Line]]] = []
    first = lines[0].text
    m = _PAR.match(first)
    rest_first = m.group(2) if m else first
    m1 = _UST.match(rest_first)
    if not m1:
        return [(par_label, lines)]
    groups.append((int(m1.group(1)), [lines[0]]))
    expected = int(m1.group(1)) + 1
    for ln in lines[1:]:
        mu = _UST.match(ln.text)
        if mu and int(mu.group(1)) == expected:
            groups.append((expected, [ln]))
            expected += 1
        else:
            groups[-1][1].append(ln)
    # pakowanie ustępów w chunki
    out: list[tuple[str, list[Line]]] = []
    buf: list[tuple[int, list[Line]]] = []

    def flush():
        if not buf:
            return
        a, b = buf[0][0], buf[-1][0]
        label = f"{par_label} ust. {a}" if a == b else f"{par_label} ust. {a}–{b}"
        out.append((label, [x for _, ls in buf for x in ls]))
        buf.clear()

    for num, ls in groups:
        tok = approx_tokens(" ".join(x.text for x in ls))
        buf_tok = approx_tokens(" ".join(x.text for _, l2 in buf for x in l2))
        if buf and buf_tok + tok > TARGET_TOKENS:
            flush()
        buf.append((num, ls))
    flush()
    return out


def chunk_legal_act(src: SourceInfo, pages: list[tuple[int, str]]) -> list[dict]:
    lines = _clean_legal_lines(pages)
    # granica treści i załączników
    split_at = next((i for i, ln in enumerate(lines) if _APPX.match(ln.text)), len(lines))
    body, appx = lines[:split_at], lines[split_at:]
    chunks: list[dict] = []
    n = 0

    for label, ulines in _legal_units(body):
        text = _lines_to_prose([x.text for x in ulines])
        if label == "preambuła":
            label = "tytuł i podstawa prawna"
        if approx_tokens(text) > MAX_TOKENS and label.startswith("§"):
            for sub_label, sub_lines in _split_ust(label, ulines):
                n += 1
                chunks.append(make_chunk(src, sub_label, _lines_to_prose([x.text for x in sub_lines]),
                                         sub_lines[0].page, n))
        else:
            n += 1
            chunks.append(make_chunk(src, label, text, ulines[0].page, n))

    # załączniki
    appendices: list[tuple[str, list[Line]]] = []
    for ln in appx:
        m = _APPX.match(ln.text)
        if m:
            if appendices and appendices[-1][0] == m.group(1) and len(appendices[-1][1]) <= 1:
                continue  # zduplikowany nagłówek („Załącznik nr 2” dwa razy pod rząd)
            appendices.append((m.group(1), []))
            continue
        if _NOISE.match(ln.text) or not appendices:
            continue
        appendices[-1][1].append(ln)

    for num, alines in appendices:
        if num in src.skip_appendices or not alines:
            continue
        title = _appendix_title(alines)
        base = f"Załącznik nr {num}" + (f" – {title}" if title else "")
        items = _split_items(alines)
        if items:
            for item_no, name, ilines in items:
                n += 1
                text = _lines_to_prose([x.text for x in ilines])
                chunks.append(make_chunk(src, f"Załącznik nr {num} pkt {item_no} ({name})", text,
                                         ilines[0].page, n))
        else:
            text = _lines_to_prose([x.text for x in alines])
            parts = pack_sentences(split_sentences(text))
            for i, part in enumerate(parts, 1):
                n += 1
                path = base if len(parts) == 1 else f"{base} (cz. {i}/{len(parts)})"
                chunks.append(make_chunk(src, path, part, alines[0].page, n))
    return chunks


def _appendix_title(lines: list[Line]) -> str:
    for ln in lines[:6]:
        t = ln.text.strip()
        if t.isupper() and len(t) > 3 and not t.startswith("CZĘ"):
            if t.startswith("ARKUSZ") or t.startswith("WYKAZ") or t.startswith("OPISY") or t.startswith("FORMULARZ"):
                return t.title() if t.startswith(("WYKAZ", "OPISY")) else t
    return ""


def _split_items(lines: list[Line]) -> list[tuple[int, str, list[Line]]]:
    """Załączniki-wykazy (np. „WYKAZ KRYTERIÓW OCENY”): osobny chunk na każdą pozycję."""
    head = " ".join(x.text for x in lines[:4]).upper()
    if not ("WYKAZ KRYTERIÓW" in head or "OPISY ELEMENTÓW" in head):
        return []
    items: list[tuple[int, str, list[Line]]] = []
    expected = 1
    for ln in lines:
        m = _ITEM.match(ln.text)
        if m and int(m.group(1)) == expected:
            name = m.group(2).strip().rstrip("−-– ").strip()
            items.append((expected, name, [ln]))
            expected += 1
        elif items:
            items[-1][2].append(ln)
    # Nazwy kryteriów są w tabeli złamane między wiersze i przemieszane z opisem – ustalamy
    # pełną nazwę ze słownika i usuwamy jej fragmenty (wersaliki) z treści opisu.
    fixed = []
    for no, name, ils in items:
        first = fold(name.split()[0])
        upper_tokens = {w.strip(",.") for x in ils for w in x.text.split() if w.isupper()}
        cands = [c for c in CRITERIA_NAMES if fold(c).startswith(first)]
        full = next((c for c in cands if all(w in upper_tokens for w in re.split(r"[ /]+", c) if len(w) > 2)),
                    cands[0] if cands else name)
        name_words = {w for w in re.split(r"[ /]+", full.upper()) if w}
        cleaned = []
        for x in ils:
            t = re.sub(r"^\d+\.\s+", "", x.text) if x is ils[0] else x.text
            words = [w for w in t.split() if not (w.isupper() and w.strip(",.") in name_words)]
            if words:
                cleaned.append(Line(" ".join(words), x.page))
        body = [Line(f"Kryterium oceny: {full}. Opis kryterium:", ils[0].page)] + cleaned
        fixed.append((no, full, body))
    return fixed


# Pełne nazwy kryteriów oceny / elementów oceny (zał. nr 1 do obu rozporządzeń).
CRITERIA_NAMES = [
    "KOMUNIKACJA", "KREATYWNOŚĆ", "NEGOCJOWANIE", "ORGANIZACJA PRACY I ORIENTACJA NA OSIĄGANIE CELÓW",
    "ORIENTACJA NA KLIENTA/INTERESANTA", "PODEJMOWANIE DECYZJI I ODPOWIEDZIALNOŚĆ",
    "RADZENIE SOBIE W SYTUACJACH KRYZYSOWYCH", "RZETELNOŚĆ", "MYŚLENIE ANALITYCZNE",
    "WYKORZYSTYWANIE WIEDZY I DOSKONALENIE ZAWODOWE", "WSPÓŁPRACA", "WYSTĄPIENIA PUBLICZNE",
    "ZARZĄDZANIE LUDŹMI", "ZARZĄDZANIE STRATEGICZNE",
]


# ---------------------------------------------------------------------------
# Poradniki
# ---------------------------------------------------------------------------

_TOC = re.compile(r"^(\d+(?:\.\d+)*)\.\s+(.+?)\s*\.{3,}\s*(\d+)\s*$")
_TOC_START = re.compile(r"^(\d+(?:\.\d+)*)\.\s+\S")
_PAGE_NO = re.compile(r"^\d{1,3}$")


def parse_toc(toc_text: str) -> list[tuple[str, str]]:
    entries: list[tuple[str, str]] = []
    pending = ""
    for raw in toc_text.splitlines():
        s = raw.strip()
        if not s:
            continue
        if pending:
            s = pending + " " + s
            pending = ""
        m = _TOC.match(s)
        if m:
            entries.append((m.group(1), m.group(2).strip()))
        elif _TOC_START.match(s):
            pending = s  # wpis złamany na dwie linie
    return entries


def chunk_guide(src: SourceInfo, pages: list[tuple[int, str]], toc_page: int = 2) -> list[dict]:
    toc_text = next((t for p, t in pages if p == toc_page), "")
    toc = parse_toc(toc_text)
    lines: list[Line] = []
    for page_no, text in pages:
        if page_no <= toc_page:
            continue
        for raw in (text or "").splitlines():
            s = raw.strip()
            if not s or _PAGE_NO.match(s):
                continue
            lines.append(Line(s, page_no))

    # lokalizacja nagłówków z spisu treści – sekwencyjnie, by uniknąć fałszywych trafień
    heads: list[tuple[int, str, str]] = []  # (index linii, numer, tytuł)
    pos = 0
    for num, title in toc:
        key = fold(f"{num}. {title}")[:28]
        for i in range(pos, len(lines)):
            if fold(lines[i].text).startswith(key[: max(8, min(len(key), 28))]):
                heads.append((i, num, title))
                pos = i + 1
                break

    titles = {num: title for _, num, title in heads}

    def crumb(num: str) -> str:
        parts = num.split(".")
        chain = [".".join(parts[: k + 1]) for k in range(len(parts))]
        return " > ".join(f"{c}. {titles[c]}" for c in chain if c in titles)

    chunks: list[dict] = []
    n = 0
    carry = ""
    for h_idx, (start, num, title) in enumerate(heads):
        end = heads[h_idx + 1][0] if h_idx + 1 < len(heads) else len(lines)
        sec_lines = lines[start + 1:end]
        body = _lines_to_prose([x.text for x in sec_lines])
        page = lines[start].page
        if approx_tokens(body) < MIN_TOKENS and h_idx + 1 < len(heads):
            carry += f"{num}. {title}\n{body}\n"
            continue
        path = f"rozdz. {num}. {title}"
        prefix_crumb = crumb(num)
        text = (carry + body) if carry else body
        carry = ""
        parts = pack_sentences(split_sentences(text))
        for i, part in enumerate(parts, 1):
            n += 1
            p = path if len(parts) == 1 else f"{path} (cz. {i}/{len(parts)})"
            ch = make_chunk(src, p, part, page, n)
            if prefix_crumb and prefix_crumb != f"{num}. {title}":
                ch["text"] = ch["text"].replace("]\n", f"]\n({prefix_crumb})\n", 1)
            chunks.append(ch)
    return chunks


# ---------------------------------------------------------------------------
# Model kompetencji (xlsx)
# ---------------------------------------------------------------------------

def chunk_competency_model(src: SourceInfo, main_rows: list[list[str]],
                           competencies: list[dict]) -> list[dict]:
    """``main_rows`` – wiersze arkusza głównego; ``competencies`` – lista
    ``{"name": str, "levels": [5 nazw poziomów], "indicators": [{"name": str, "levels": [5 opisów]}]}``."""
    chunks: list[dict] = []
    n = 0
    intro = [r[0] for r in main_rows if len(r) == 1 and r[0]]
    table = [r for r in main_rows if len(r) >= 3 and r[0].isdigit()]
    rules = "Zasady stosowania modelu kompetencji:\n" + "\n".join(f"- {x}" for x in intro[1:])
    rules += "\n\nKompetencje w modelu (liczba wskaźników behawioralnych):\n" + "\n".join(
        f"{r[0]}. {r[1]} – {r[2]}" for r in table)
    n += 1
    chunks.append(make_chunk(src, "arkusz główny – zasady i wykaz kompetencji", rules, None, n))

    for comp in competencies:
        name = comp["name"]
        inds = comp["indicators"]
        n += 1
        overview = (f"Kompetencja: {name}\nLiczba wskaźników behawioralnych: {len(inds)}\n"
                    "Wskaźniki behawioralne:\n" + "\n".join(f"{i}. {ind['name']}" for i, ind in enumerate(inds, 1))
                    + "\nKażdy wskaźnik oceniany jest w 5 poziomach: " + ", ".join(comp["levels"]) + ".")
        chunks.append(make_chunk(src, f"{name} – lista wskaźników", overview, None, n))
        for i, ind in enumerate(inds, 1):
            n += 1
            body = [f"Kompetencja: {name}", f"Wskaźnik behawioralny {i}/{len(inds)}: {ind['name']}",
                    "Opisy zachowań na poszczególnych poziomach:"]
            for lvl, desc in zip(comp["levels"], ind["levels"]):
                body.append(f"- {lvl}: {desc}")
            chunks.append(make_chunk(src, f"{name} – wskaźnik {i}", "\n".join(body), None, n))
    return chunks


# ---------------------------------------------------------------------------
# Formularze (docx)
# ---------------------------------------------------------------------------

def chunk_form(src: SourceInfo, blocks: list[str], footnotes: dict[str, str]) -> list[dict]:
    """``blocks`` – kolejne akapity / wiersze tabel arkusza; sekcje dzielone są na nagłówkach
    pisanych wersalikami (CZĘŚĆ I, ROZMOWA WSTĘPNA itd.)."""
    sections: list[tuple[str, list[str]]] = []
    for b in blocks:
        b = b.strip()
        if not b:
            continue
        is_head = b.isupper() and len(b) > 4 and "|" not in b and not b.startswith("(")
        if is_head and (b.startswith("CZĘŚĆ") or not sections or len(sections[-1][1]) > 0):
            sections.append((b, []))
        elif sections:
            sections[-1][1].append(b)
        else:
            sections.append(("NAGŁÓWEK", [b]))

    chunks: list[dict] = []
    n = 0
    buf_heads: list[str] = []
    buf_text: list[str] = []

    def flush():
        nonlocal n
        if not buf_text:
            return
        n += 1
        heads = [h.capitalize() for h in dict.fromkeys(buf_heads) if h != "NAGŁÓWEK"]
        path = " / ".join(heads[:3]) + (" …" if len(heads) > 3 else "")
        chunks.append(make_chunk(src, path or "nagłówek", "\n".join(buf_text), None, n))
        buf_heads.clear()
        buf_text.clear()

    for head, items in sections:
        text = "\n".join([head] + items)
        if buf_text and approx_tokens("\n".join(buf_text)) + approx_tokens(text) > TARGET_TOKENS:
            flush()
        buf_heads.append(head)
        buf_text.append(text)
    flush()

    if footnotes:
        notes = [f"Przypis {k}: {v}" for k, v in footnotes.items()]
        for i, part in enumerate(pack_sentences(notes, overlap=0), 1):
            n += 1
            chunks.append(make_chunk(src, f"objaśnienia (przypisy) do arkusza, cz. {i}", part, None, n))
    return chunks
