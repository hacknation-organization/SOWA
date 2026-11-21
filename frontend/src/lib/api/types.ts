// Typy zgodne z kontraktem API (prefiks /api).

export type Role = "przelozony" | "hr" | "admin";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  role: Role;
  display_name: string;
}

export type LevelValue = 1 | 2 | 3 | 4 | 5;

export interface IndicatorLevel {
  level: LevelValue;
  label: string;
  description: string;
}

export interface Indicator {
  id: string;
  name: string;
  levels: IndicatorLevel[];
}

export interface Competency {
  id: string;
  name: string;
  indicators: Indicator[];
}

export interface Employee {
  id: string;
  full_name: string;
  position: string;
  unit: string;
  /** Data zatrudnienia w służbie cywilnej (ISO). */
  hired_at?: string;
}

export type ProcessType = "first" | "periodic";
export type FormType = "B" | "C";

export type ProcessStage =
  | "job_description"
  | "criteria"
  | "assessment"
  | "summary"
  | "interview"
  | "document";

export type ProcessStatus = "not_started" | "in_progress" | "completed" | "overdue";

export interface Rating {
  indicator_id: string;
  level: LevelValue | null;
  example?: string;
}

export interface Process {
  id: string;
  employee_id: string;
  employee_name?: string;
  unit?: string;
  type: ProcessType;
  form: FormType | null;
  stage: ProcessStage;
  status: ProcessStatus;
  deadline?: string;
  created_at?: string;
  updated_at?: string;
  job_description?: string;
  competency_ids?: string[];
  ratings?: Rating[];
  reminder_sent_at?: string | null;
}

export interface CreateProcessRequest {
  employee_id: string;
  type: ProcessType;
  form: FormType | null;
}

export interface CompetencySummary {
  competency_id: string;
  rated: number;
  total: number;
  no_basis: number;
  suggested_level: LevelValue | null;
  explanation: string;
  manager_level: LevelValue | null;
  justification: string | null;
}

export interface DecisionRequest {
  level: LevelValue;
  justification: string;
}

export interface HrProcessFilters {
  status?: ProcessStatus | "";
  unit?: string;
  type?: ProcessType | "";
}

export type AssistantMode = "formal" | "interview";

export interface AskRequest {
  question: string;
  mode: AssistantMode;
  process_id?: string;
}

export interface Citation {
  marker: string;
  source: string;
  path: string;
  page: number | null;
  excerpt: string;
}

export type Confidence = "high" | "partial" | "none";

export interface AskResponse {
  answer: string;
  citations: Citation[];
  confidence: Confidence;
}

/** Pola procesu, które frontend zapisuje na etapie opisu stanowiska. */
export interface UpdateProcessRequest {
  job_description?: string;
  form?: FormType | null;
  stage?: ProcessStage;
}

export const LEVEL_LABELS: Record<LevelValue, string> = {
  1: "Znacznie poniżej oczekiwań",
  2: "Poniżej oczekiwań",
  3: "Na poziomie oczekiwań",
  4: "Powyżej oczekiwań",
  5: "Znacznie powyżej oczekiwań",
};

export const STAGES: { id: ProcessStage; label: string }[] = [
  { id: "job_description", label: "Opis stanowiska" },
  { id: "criteria", label: "Kryteria" },
  { id: "assessment", label: "Ocena zachowań" },
  { id: "summary", label: "Podsumowanie" },
  { id: "interview", label: "Rozmowa" },
  { id: "document", label: "Dokument" },
];

export const STATUS_LABELS: Record<ProcessStatus, string> = {
  not_started: "Nierozpoczęta",
  in_progress: "W toku",
  completed: "Zakończona",
  overdue: "Po terminie",
};

export const TYPE_LABELS: Record<ProcessType, string> = {
  first: "Pierwsza ocena",
  periodic: "Ocena okresowa",
};
