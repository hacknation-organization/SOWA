"""Modele bazy danych.

Minimalizacja danych: o pracowniku przechowujemy wyłącznie imię, nazwisko, stanowisko
i komórkę organizacyjną – bez PESEL, adresów, danych kontaktowych itp.
"""

from datetime import UTC, date, datetime

from sqlmodel import Field, SQLModel, UniqueConstraint


def utcnow() -> datetime:
    return datetime.now(UTC)


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    role: str  # przelozony | hr | admin
    display_name: str
    unit: str | None = None


class Employee(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    first_name: str
    last_name: str
    position: str
    unit: str
    manager_id: int | None = Field(default=None, foreign_key="user.id", index=True)


class Process(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="employee.id", index=True)
    manager_id: int = Field(foreign_key="user.id", index=True)
    type: str  # first | periodic
    form: str | None = None  # B | C | None (pierwsza ocena)
    stage: str = "job_description"
    status: str = "in_progress"  # in_progress | completed
    period_start: date | None = None
    period_end: date | None = None
    deadline: date | None = None
    job_description: str | None = None
    interview_date: date | None = None
    interview_notes: str | None = None
    development_plan: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class ProcessCompetency(SQLModel, table=True):
    """Kryteria oceny (kompetencje) wybrane dla procesu."""

    __table_args__ = (UniqueConstraint("process_id", "competency_id"),)
    id: int | None = Field(default=None, primary_key=True)
    process_id: int = Field(foreign_key="process.id", index=True)
    competency_id: str
    position: int = 0


class Rating(SQLModel, table=True):
    """Ocena wskaźnika behawioralnego. level=None oznacza „brak podstaw do oceny”."""

    __table_args__ = (UniqueConstraint("process_id", "indicator_id"),)
    id: int | None = Field(default=None, primary_key=True)
    process_id: int = Field(foreign_key="process.id", index=True)
    competency_id: str
    indicator_id: str
    level: int | None = None
    example: str | None = None
    updated_at: datetime = Field(default_factory=utcnow)


class Decision(SQLModel, table=True):
    """Ostateczny poziom kompetencji ustalony przez przełożonego."""

    __table_args__ = (UniqueConstraint("process_id", "competency_id"),)
    id: int | None = Field(default=None, primary_key=True)
    process_id: int = Field(foreign_key="process.id", index=True)
    competency_id: str
    level: int
    suggested_level: int | None = None
    justification: str | None = None
    updated_at: datetime = Field(default_factory=utcnow)


class Reminder(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    process_id: int = Field(foreign_key="process.id", index=True)
    sent_by: int = Field(foreign_key="user.id")
    recipient_id: int = Field(foreign_key="user.id")
    message: str
    channel: str = "log"
    created_at: datetime = Field(default_factory=utcnow)
