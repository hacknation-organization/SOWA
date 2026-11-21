"""Schematy Pydantic – kontrakt API dla frontendu."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Role = Literal["przelozony", "hr", "admin"]
ProcessType = Literal["first", "periodic"]
FormType = Literal["B", "C"]
Stage = Literal["job_description", "criteria", "assessment", "summary", "interview", "document"]
Status = Literal["in_progress", "completed"]
Level = int


# --- auth -----------------------------------------------------------------
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    display_name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    role: Role
    display_name: str
    unit: str | None = None


# --- model kompetencji ------------------------------------------------------
class LevelDescription(BaseModel):
    level: int = Field(ge=1, le=5)
    label: str
    description: str


class IndicatorOut(BaseModel):
    id: str
    name: str
    levels: list[LevelDescription]


class CompetencyOut(BaseModel):
    id: str
    name: str
    indicators: list[IndicatorOut]


# --- pracownicy -------------------------------------------------------------
class EmployeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    first_name: str
    last_name: str
    position: str
    unit: str


# --- procesy ----------------------------------------------------------------
class ProcessCreate(BaseModel):
    employee_id: int
    type: ProcessType
    form: FormType | None = None
    period_start: date | None = None
    period_end: date | None = None
    deadline: date | None = None


class ProcessListItem(BaseModel):
    id: int
    employee: EmployeeOut
    type: ProcessType
    form: FormType | None
    stage: Stage
    status: Status
    deadline: date | None
    overdue: bool
    progress: float = Field(description="Odsetek ocenionych wskaźników wybranych kompetencji (0–1)")
    updated_at: datetime


class RatingOut(BaseModel):
    indicator_id: str
    competency_id: str
    level: int | None
    example: str | None


class DecisionOut(BaseModel):
    competency_id: str
    level: int
    suggested_level: int | None
    justification: str | None


class ProcessDetail(ProcessListItem):
    stages: list[Stage]
    manager_name: str
    period_start: date | None
    period_end: date | None
    job_description: str | None
    interview_date: date | None
    interview_notes: str | None
    development_plan: str | None
    criteria: list[str]
    ratings: list[RatingOut]
    decisions: list[DecisionOut]
    created_at: datetime


class ProcessUpdate(BaseModel):
    """Częściowa aktualizacja procesu (etap, opis stanowiska, rozmowa, plan rozwoju)."""

    stage: Stage | None = None
    status: Status | None = None
    job_description: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    deadline: date | None = None
    interview_date: date | None = None
    interview_notes: str | None = None
    development_plan: str | None = None


class CriteriaUpdate(BaseModel):
    competency_ids: list[str]


class RatingUpdate(BaseModel):
    level: int | None = Field(default=None, ge=1, le=5, description="1–5 albo null = brak podstaw do oceny")
    example: str | None = Field(default=None, max_length=4000)


class SummaryItem(BaseModel):
    competency_id: str
    competency_name: str
    rated: int
    total: int
    no_basis: int
    rated_levels: list[int]
    suggested_level: int | None
    explanation: str
    manager_level: int | None
    justification: str | None


class DecisionUpdate(BaseModel):
    level: int = Field(ge=1, le=5)
    justification: str | None = Field(default=None, max_length=4000)


# --- HR ---------------------------------------------------------------------
class HrProcessItem(BaseModel):
    id: int
    employee_name: str
    position: str
    unit: str
    manager_name: str
    type: ProcessType
    form: FormType | None
    stage: Stage
    status: Status
    deadline: date | None
    overdue: bool
    progress: float
    last_reminder_at: datetime | None


class ReminderRequest(BaseModel):
    process_ids: list[int] = Field(min_length=1)
    message: str | None = Field(default=None, max_length=1000)


class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    process_id: int
    recipient_id: int
    message: str
    channel: str
    created_at: datetime


class ReminderResponse(BaseModel):
    created: int
    reminders: list[ReminderOut]


# --- asystent ---------------------------------------------------------------
class AskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    mode: Literal["formal", "interview"] = "formal"
    process_id: int | None = None


class Citation(BaseModel):
    marker: str
    source: str
    path: str | None = None
    page: int | None = None
    excerpt: str | None = None


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation] = []
    confidence: Literal["high", "partial", "none"]
