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
from reportlab.platypus import Flowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlmodel import Session

from app.domain.competency_model import get_competency_model
from app.domain.scoring import LEVEL_LABELS
from app.models import Employee, Process, Rating, User
from app.schemas import SummaryItem
from app.services import processes as svc

FONT_DIR = Path(__file__).parent / "fonts"
FONT, FONT_BOLD = "DejaVuSans", "DejaVuSans-Bold"
GRID_COLOR = colors.HexColor("#9aa4b2")
HEADER_BACKGROUND = colors.HexColor("#e8edf3")
SIGNATURE_LINE = "...................................."
FOOTNOTE = (
    "Poziom sugerowany wyliczono automatycznie jako medianę ocen wskaźników behawioralnych "
    "(z pominięciem „brak podstaw do oceny”, przy remisie – wartość niższa). Ostateczny poziom "
    "ustala przełożony. Dokument wygenerowany w aplikacji Kompas kompetencji (prototyp)."
)

HEADER_ROW_STYLE = TableStyle(
    [
        ("GRID", (0, 0), (-1, -1), 0.4, GRID_COLOR),
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BACKGROUND),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
)
HEADER_COLUMN_STYLE = TableStyle(
    [
        ("GRID", (0, 0), (-1, -1), 0.4, GRID_COLOR),
        ("BACKGROUND", (0, 0), (0, -1), HEADER_BACKGROUND),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]
)

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


def _table(rows: list[list[Flowable]], col_widths_mm: list[float], style: TableStyle, **kwargs) -> Table:
    table = Table(rows, colWidths=[width * mm for width in col_widths_mm], **kwargs)
    table.setStyle(style)
    return table


def _title(process: Process) -> str:
    if process.type == "first":
        return "ARKUSZ PIERWSZEJ OCENY"
    return f"ARKUSZ OCENY OKRESOWEJ – {process.form or ''}".strip(" –")


def _info_table(process: Process, employee: Employee, manager: User | None, st: dict) -> Table:
    fields = [
        ("Imię i nazwisko ocenianego", f"{employee.first_name} {employee.last_name}"),
        ("Stanowisko", employee.position),
        ("Komórka organizacyjna", employee.unit),
        ("Oceniający (bezpośredni przełożony)", manager.display_name if manager else ""),
        ("Okres objęty oceną", f"{_fmt_date(process.period_start)} – {_fmt_date(process.period_end)}"),
        ("Termin sporządzenia oceny", _fmt_date(process.deadline)),
    ]
    rows = [[_p(label, st["cellb"]), _p(value, st["cell"])] for label, value in fields]
    return _table(rows, [60, 110], HEADER_COLUMN_STYLE)


def _summary_section(summary: list[SummaryItem], st: dict) -> list[Flowable]:
    headers = ("Kompetencja", "Poziom sugerowany", "Poziom ustalony", "Uzasadnienie")
    rows = [[_p(header, st["cellb"]) for header in headers]]
    for item in summary:
        rows.append(
            [
                _p(item.competency_name, st["cellb"]),
                _p(_level(item.suggested_level) if item.suggested_level else "—", st["cell"]),
                _p(_level(item.manager_level) if item.manager_level else "nie ustalono", st["cell"]),
                _p(item.justification, st["cell"]),
            ]
        )
    return [
        _p("Wyniki oceny w zakresie kryteriów (kompetencji)", st["h2"]),
        _table(rows, [45, 35, 35, 55], HEADER_ROW_STYLE, repeatRows=1),
    ]


def _indicator_row(indicator: dict, rating: Rating | None, st: dict) -> list[Flowable]:
    if rating is None:
        return [_p(indicator["name"], st["cell"]), _p("nie oceniono", st["cell"]), _p("", st["cell"])]
    behaviour = indicator["levels"][rating.level - 1]["description"] if rating.level else ""
    text = behaviour + (f"\nPrzykład: {rating.example}" if rating.example else "")
    return [_p(indicator["name"], st["cell"]), _p(_level(rating.level), st["cell"]), _p(text, st["cell"])]


def _indicators_section(summary: list[SummaryItem], ratings: list[Rating], st: dict) -> list[Flowable]:
    model = get_competency_model()
    story: list[Flowable] = [_p("Ocena wskaźników behawioralnych", st["h2"])]
    for item in summary:
        competency = model.competency(item.competency_id)
        by_indicator = {r.indicator_id: r for r in ratings if r.competency_id == item.competency_id}
        headers = ("Wskaźnik", "Poziom", "Obserwowane zachowanie / przykład")
        rows = [[_p(header, st["cellb"]) for header in headers]]
        rows += [
            _indicator_row(indicator, by_indicator.get(indicator["id"]), st)
            for indicator in competency["indicators"]
        ]
        story += [
            _p(f"{item.competency_name} – ocenione {item.rated}/{item.total}", st["cellb"]),
            Spacer(1, 1 * mm),
            _table(rows, [55, 30, 85], HEADER_ROW_STYLE, repeatRows=1),
            _p(item.explanation, st["small"]),
            Spacer(1, 3 * mm),
        ]
    return story


def _interview_section(process: Process, st: dict) -> list[Flowable]:
    story: list[Flowable] = [
        _p("Rozmowa oceniająca", st["h2"]),
        _p(f"Data rozmowy: {_fmt_date(process.interview_date)}", st["body"]),
    ]
    if process.interview_notes:
        story.append(_p(process.interview_notes, st["body"]))
    story += [
        _p("Wskazówki dotyczące rozwoju zawodowego", st["h2"]),
        _p(process.development_plan, st["body"]),
    ]
    return story


def _signature_section(st: dict) -> list[Flowable]:
    signature = Table(
        [
            [_p(SIGNATURE_LINE, st["cell"]), _p(SIGNATURE_LINE, st["cell"])],
            [_p("data i podpis oceniającego", st["small"]), _p("data i podpis ocenianego", st["small"])],
        ],
        colWidths=[85 * mm, 85 * mm],
    )
    return [Spacer(1, 12 * mm), signature, Spacer(1, 8 * mm), _p(FOOTNOTE, st["small"])]


def render_process_pdf(session: Session, process: Process) -> bytes:
    _register_fonts()
    st = _styles()
    employee = session.get(Employee, process.employee_id)
    manager = session.get(User, process.manager_id)
    summary = svc.summary(session, process)
    ratings = svc.ratings_for(session, process.id)
    title = _title(process)

    story: list[Flowable] = [
        _p(title, st["title"]),
        Spacer(1, 3 * mm),
        _info_table(process, employee, manager, st),
    ]
    if process.job_description:
        story += [
            _p("Zadania na stanowisku (na podstawie opisu stanowiska pracy)", st["h2"]),
            _p(process.job_description, st["body"]),
        ]
    story += _summary_section(summary, st)
    story += _indicators_section(summary, ratings, st)
    story += _interview_section(process, st)
    story += _signature_section(st)

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(FONT, 7)
        canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, f"Proces nr {process.id} · strona {doc.page}")
        canvas.restoreState()

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=15 * mm,
        bottomMargin=18 * mm,
        title=title,
        author="Kompas kompetencji",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
