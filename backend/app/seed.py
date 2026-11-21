"""Dane demonstracyjne: fikcyjni użytkownicy, pracownicy i procesy w różnych etapach.

Wszyscy użytkownicy demo mają hasło DEMO_PASSWORD. Dane osobowe są fikcyjne.
"""

from datetime import date, timedelta

from sqlmodel import Session, select

from app.core.security import hash_password
from app.domain.competency_model import get_competency_model
from app.domain.scoring import suggest_level
from app.models import Decision, Employee, Process, ProcessCompetency, Rating, User

DEMO_PASSWORD = "demo123"

USERS = [
    ("przelozony", "przelozony", "Anna Przykładowa", "Departament Cyfryzacji Usług"),
    ("przelozony2", "przelozony", "Tomasz Testowy", "Biuro Administracyjne"),
    ("hr", "hr", "Ewa Kadrowa", "Biuro Dyrektora Generalnego"),
    ("admin", "admin", "Administrator Systemu", None),
]

EMPLOYEES = [
    ("Jan", "Kowalczyk", "Główny specjalista ds. analiz", "Departament Cyfryzacji Usług", "przelozony"),
    (
        "Maria",
        "Zielińska",
        "Starszy specjalista ds. legislacji",
        "Departament Cyfryzacji Usług",
        "przelozony",
    ),
    ("Piotr", "Wiśniak", "Specjalista ds. obsługi klienta", "Departament Cyfryzacji Usług", "przelozony"),
    ("Agnieszka", "Lis", "Naczelnik wydziału", "Departament Cyfryzacji Usług", "przelozony"),
    (
        "Krzysztof",
        "Malinowski",
        "Inspektor ds. zamówień publicznych",
        "Departament Cyfryzacji Usług",
        "przelozony",
    ),
    ("Barbara", "Sowa", "Starszy referent", "Biuro Administracyjne", "przelozony2"),
    ("Michał", "Dąbek", "Główny specjalista ds. budżetu", "Biuro Administracyjne", "przelozony2"),
]

# wzorzec poziomów do deterministycznego wypełnienia ocen demo (None = brak podstaw)
PATTERN = [3, 4, 3, None, 4, 3, 5, 2, 3, 4]


def _fill_ratings(
    session: Session, process: Process, competency_ids: list[str], limit: int | None = None
) -> None:
    model = get_competency_model()
    i = 0
    for cid in competency_ids:
        for ind in model.competency(cid)["indicators"]:
            if limit is not None and i >= limit:
                return
            level = PATTERN[i % len(PATTERN)]
            example = (
                "W II kwartale samodzielnie przygotował analizę i terminowo przekazał ją do akceptacji."
                if level and level >= 4
                else None
            )
            session.add(
                Rating(
                    process_id=process.id,
                    competency_id=cid,
                    indicator_id=ind["id"],
                    level=level,
                    example=example,
                )
            )
            i += 1


def _set_criteria(session: Session, process: Process, competency_ids: list[str]) -> None:
    for pos, cid in enumerate(competency_ids):
        session.add(ProcessCompetency(process_id=process.id, competency_id=cid, position=pos))


def _decide(session: Session, process: Process, competency_ids: list[str], bump_first: bool = False) -> None:
    model = get_competency_model()
    session.flush()
    for n, cid in enumerate(competency_ids):
        levels = [
            r.level
            for r in session.exec(
                select(Rating).where(Rating.process_id == process.id, Rating.competency_id == cid)
            ).all()
        ]
        suggested = suggest_level(levels, total=len(model.competency(cid)["indicators"])).suggested_level or 3
        level, justification = suggested, None
        if bump_first and n == 0 and suggested < 5:
            level = suggested + 1
            justification = (
                "Wyróżniający wkład w projekt wdrożenia e-usługi, potwierdzony opinią interesariuszy."
            )
        session.add(
            Decision(
                process_id=process.id,
                competency_id=cid,
                level=level,
                suggested_level=suggested,
                justification=justification,
            )
        )


def seed_demo(session: Session) -> bool:
    """Wypełnia pustą bazę danymi demo. Zwraca False, jeśli dane już istnieją."""
    if session.exec(select(User)).first() is not None:
        return False

    users: dict[str, User] = {}
    pwd = hash_password(DEMO_PASSWORD)
    for username, role, display_name, unit in USERS:
        users[username] = User(
            username=username, password_hash=pwd, role=role, display_name=display_name, unit=unit
        )
        session.add(users[username])
    session.flush()

    employees = []
    for first, last, position, unit, manager in EMPLOYEES:
        e = Employee(
            first_name=first, last_name=last, position=position, unit=unit, manager_id=users[manager].id
        )
        session.add(e)
        employees.append(e)
    session.flush()

    today = date.today()
    period = {"period_start": date(today.year - 1, 1, 1), "period_end": date(today.year - 1, 12, 31)}
    mgr = users["przelozony"].id

    # 1) Ocena okresowa B – dopiero założona
    p1 = Process(
        employee_id=employees[0].id,
        manager_id=mgr,
        type="periodic",
        form="B",
        deadline=today + timedelta(days=30),
        **period,
    )
    # 2) Pierwsza ocena – w trakcie oceny wskaźników
    p2 = Process(
        employee_id=employees[2].id,
        manager_id=mgr,
        type="first",
        form=None,
        stage="assessment",
        period_start=today - timedelta(days=150),
        period_end=today - timedelta(days=5),
        deadline=today + timedelta(days=10),
        job_description="Obsługa zgłoszeń obywateli w kanale elektronicznym, prowadzenie rejestru spraw, "
        "udzielanie informacji o e-usługach.",
    )
    # 3) Ocena okresowa C (kierownicza) – podsumowanie, termin minął
    p3 = Process(
        employee_id=employees[3].id,
        manager_id=mgr,
        type="periodic",
        form="C",
        stage="summary",
        deadline=today - timedelta(days=3),
        job_description="Kierowanie wydziałem (8 osób), planowanie pracy, nadzór nad projektami "
        "cyfryzacji usług publicznych.",
        **period,
    )
    # 4) Ocena okresowa B – zakończona (inny przełożony)
    p4 = Process(
        employee_id=employees[5].id,
        manager_id=users["przelozony2"].id,
        type="periodic",
        form="B",
        stage="document",
        status="completed",
        deadline=today - timedelta(days=20),
        interview_date=today - timedelta(days=25),
        interview_notes="Omówiono wyniki oceny i oczekiwania na kolejny okres.",
        development_plan="Szkolenie z redagowania pism urzędowych prostym językiem.",
        job_description="Prowadzenie sekretariatu, obieg dokumentów w EZD.",
        **period,
    )
    for p in (p1, p2, p3, p4):
        session.add(p)
    session.flush()

    c2 = ["K01", "K02", "K10"]
    _set_criteria(session, p2, c2)
    _fill_ratings(session, p2, c2, limit=5)

    c3 = ["K01", "K04", "K06", "K13", "K14"]
    _set_criteria(session, p3, c3)
    _fill_ratings(session, p3, c3)
    _decide(session, p3, c3[:2], bump_first=True)

    c4 = ["K01", "K02", "K04"]
    _set_criteria(session, p4, c4)
    _fill_ratings(session, p4, c4)
    _decide(session, p4, c4)

    session.commit()
    return True
