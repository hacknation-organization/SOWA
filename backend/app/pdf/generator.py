"""Generowanie arkusza oceny w PDF (reportlab, osadzona czcionka DejaVu Sans)."""

from datetime import date
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlmodel import Session

from app.domain.competency_model import get_competency_model
from app.domain.scoring import LEVEL_LABELS
from app.models import Employee, Process, User
from app.services import processes as svc

FONT_DIR = Path(__file__).parent / "fonts"
FONT, FONT_BOLD = "DejaVuSans", "DejaVuSans-Bold"
_fonts_registered = False


def _register_fonts() -> None:
    global _fonts_registered
    if not _fonts_registered:
        pdfmetrics.registerFont(TTFont(FONT, str(FONT_DIR / "DejaVuSans.ttf")))
        pdfmetrics.registerFont(TTFont(FONT_BOLD, str(FONT_DIR / "DejaVuSans-Bold.ttf")))
        pdfmetrics.registerFontFamily(FONT, normal=FONT, bold=FONT_BOLD, italic=FONT, boldItalic=FONT_BOLD)
        _fonts_registered = True


def _styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "t", parent=base["Title"], fontName=FONT_BOLD, fontSize=15, alignment=TA_CENTER
        ),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName=FONT_BOLD, fontSize=11.5, spaceBefore=8),
        "body": ParagraphStyle("b", parent=base["BodyText"], fontName=FONT, fontSize=9, leading=12),
        "small": ParagraphStyle("s", parent=base["BodyText"], fontName=FONT, fontSize=7.5, leading=9.5),
        "cell": ParagraphStyle("c", parent=base["BodyText"], fontName=FONT, fontSize=8, leading=10),
        "cellb": ParagraphStyle("cb", parent=base["BodyText"], fontName=FONT_BOLD, fontSize=8, leading=10),
    }


def _p(text: object, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(str(text if text not in (None, "") else "—")).replace("\n", "<br/>"), style)


def _level(level: int | None) -> str:
    return f"{level} – {LEVEL_LABELS[level]}" if level else "brak podstaw do oceny"


def _fmt_date(d: date | None) -> str:
    return d.strftime("%d.%m.%Y") if d else "—"


TABLE_STYLE = TableStyle(
    [
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9aa4b2")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8edf3")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
)


def render_process_pdf(session: Session, process: Process) -> bytes:
    _register_fonts()
    st = _styles()
    model = get_competency_model()
    employee = session.get(Employee, process.employee_id)
    manager = session.get(User, process.manager_id)
    summary = svc.summary(session, process)
    ratings = svc.ratings_for(session, process.id)

    if process.type == "first":
        title = "ARKUSZ PIERWSZEJ OCENY"
    else:
        title = f"ARKUSZ OCENY OKRESOWEJ – {process.form or ''}".strip(" –")

    story: list = [_p(title, st["title"]), Spacer(1, 3 * mm)]

    info = [
        [
            _p("Imię i nazwisko ocenianego", st["cellb"]),
            _p(f"{employee.first_name} {employee.last_name}", st["cell"]),
        ],
        [_p("Stanowisko", st["cellb"]), _p(employee.position, st["cell"])],
        [_p("Komórka organizacyjna", st["cellb"]), _p(employee.unit, st["cell"])],
        [
            _p("Oceniający (bezpośredni przełożony)", st["cellb"]),
            _p(manager.display_name if manager else "", st["cell"]),
        ],
        [
            _p("Okres objęty oceną", st["cellb"]),
            _p(f"{_fmt_date(process.period_start)} – {_fmt_date(process.period_end)}", st["cell"]),
        ],
        [_p("Termin sporządzenia oceny", st["cellb"]), _p(_fmt_date(process.deadline), st["cell"])],
    ]
    t = Table(info, colWidths=[60 * mm, 110 * mm])
    t.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9aa4b2")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8edf3")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story += [t]

    if process.job_description:
        story += [_p("Zadania na stanowisku (na podstawie opisu stanowiska pracy)", st["h2"])]
        story += [_p(process.job_description, st["body"])]

    story += [_p("Wyniki oceny w zakresie kryteriów (kompetencji)", st["h2"])]
    rows = [
        [_p(h, st["cellb"]) for h in ("Kompetencja", "Poziom sugerowany", "Poziom ustalony", "Uzasadnienie")]
    ]
    for item in summary:
        rows.append(
            [
                _p(item.competency_name, st["cellb"]),
                _p(_level(item.suggested_level) if item.suggested_level else "—", st["cell"]),
                _p(_level(item.manager_level) if item.manager_level else "nie ustalono", st["cell"]),
                _p(item.justification, st["cell"]),
            ]
        )
    t = Table(rows, colWidths=[45 * mm, 35 * mm, 35 * mm, 55 * mm], repeatRows=1)
    t.setStyle(TABLE_STYLE)
    story += [t]

    story += [_p("Ocena wskaźników behawioralnych", st["h2"])]
    for item in summary:
        comp = model.competency(item.competency_id)
        story += [
            _p(f"{item.competency_name} – ocenione {item.rated}/{item.total}", st["cellb"]),
            Spacer(1, 1 * mm),
        ]
        rows = [[_p(h, st["cellb"]) for h in ("Wskaźnik", "Poziom", "Obserwowane zachowanie / przykład")]]
        by_indicator = {r.indicator_id: r for r in ratings if r.competency_id == item.competency_id}
        for ind in comp["indicators"]:
            r = by_indicator.get(ind["id"])
            if r is None:
                rows.append([_p(ind["name"], st["cell"]), _p("nie oceniono", st["cell"]), _p("", st["cell"])])
                continue
            behaviour = ind["levels"][r.level - 1]["description"] if r.level else ""
            text = behaviour + (f"\nPrzykład: {r.example}" if r.example else "")
            rows.append([_p(ind["name"], st["cell"]), _p(_level(r.level), st["cell"]), _p(text, st["cell"])])
        t = Table(rows, colWidths=[55 * mm, 30 * mm, 85 * mm], repeatRows=1)
        t.setStyle(TABLE_STYLE)
        story += [t, _p(item.explanation, st["small"]), Spacer(1, 3 * mm)]

    story += [_p("Rozmowa oceniająca", st["h2"])]
    story += [_p(f"Data rozmowy: {_fmt_date(process.interview_date)}", st["body"])]
    if process.interview_notes:
        story += [_p(process.interview_notes, st["body"])]
    story += [
        _p("Wskazówki dotyczące rozwoju zawodowego", st["h2"]),
        _p(process.development_plan, st["body"]),
    ]

    story += [Spacer(1, 12 * mm)]
    sign = Table(
        [
            [
                _p("....................................", st["cell"]),
                _p("....................................", st["cell"]),
            ],
            [_p("data i podpis oceniającego", st["small"]), _p("data i podpis ocenianego", st["small"])],
        ],
        colWidths=[85 * mm, 85 * mm],
    )
    story += [sign, Spacer(1, 8 * mm)]
    story += [
        _p(
            "Poziom sugerowany wyliczono automatycznie jako medianę ocen wskaźników behawioralnych "
            "(z pominięciem „brak podstaw do oceny”, przy remisie – wartość niższa). Ostateczny poziom "
            "ustala przełożony. Dokument wygenerowany w aplikacji Kompas kompetencji (prototyp).",
            st["small"],
        )
    ]

    buf = BytesIO()

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(FONT, 7)
        canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, f"Proces nr {process.id} · strona {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=15 * mm,
        bottomMargin=18 * mm,
        title=title,
        author="Kompas kompetencji",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
