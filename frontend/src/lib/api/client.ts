import type {
  AskRequest,
  AskResponse,
  Competency,
  CompetencySummary,
  CreateProcessRequest,
  DecisionRequest,
  Employee,
  HrProcessFilters,
  LevelValue,
  LoginRequest,
  LoginResponse,
  Process,
  ProcessStatus,
  UpdateProcessRequest,
} from "./types";

export interface ApiClient {
  login(body: LoginRequest): Promise<LoginResponse>;
  getCompetencies(): Promise<Competency[]>;
  getEmployees(): Promise<Employee[]>;
  getProcesses(): Promise<Process[]>;
  createProcess(body: CreateProcessRequest): Promise<Process>;
  getProcess(id: string): Promise<Process>;
  updateProcess(id: string, body: UpdateProcessRequest): Promise<Process>;
  setCriteria(id: string, competencyIds: string[]): Promise<Process>;
  setRating(
    id: string,
    indicatorId: string,
    body: { level: LevelValue | null; example?: string },
  ): Promise<Process>;
  getSummary(id: string): Promise<CompetencySummary[]>;
  setDecision(id: string, competencyId: string, body: DecisionRequest): Promise<CompetencySummary[]>;
  getPdf(id: string): Promise<Blob>;
  getHrProcesses(filters: HrProcessFilters): Promise<Process[]>;
  sendReminders(processIds: string[]): Promise<{ sent: number }>;
  ask(body: AskRequest): Promise<AskResponse>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const SESSION_STORAGE_KEY = "kk.session";

export function readStoredToken(): string | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LoginResponse).access_token : null;
  } catch {
    return null;
  }
}

export function createHttpClient(baseUrl: string): ApiClient {
  const root = baseUrl.replace(/\/$/, "") + "/api";

  async function request<T>(path: string, init: RequestInit = {}, raw = false): Promise<T> {
    const token = readStoredToken();
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(root + path, { ...init, headers });
    if (!res.ok) {
      let message = `Błąd serwera (${res.status})`;
      try {
        const data = await res.json();
        if (typeof data?.detail === "string") message = data.detail;
      } catch {}
      throw new ApiError(res.status, message);
    }
    if (raw) return (await res.blob()) as T;
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const json = (body: unknown) => JSON.stringify(body);
  const getProcess = (id: string) => request<BackendProcess>(`/processes/${id}`).then(toProcess);
  const getSummary = (id: string) => request<CompetencySummary[]>(`/processes/${id}/summary`);

  return {
    login: (body) => request("/auth/login", { method: "POST", body: json(body) }),
    getCompetencies: () => request("/competencies"),
    getEmployees: () => request<BackendEmployee[]>("/employees").then((list) => list.map(toEmployee)),
    getProcesses: () => request<BackendProcess[]>("/processes").then((list) => list.map(toProcess)),
    createProcess: (body) =>
      request<BackendProcess>("/processes", {
        method: "POST",
        body: json({ ...body, employee_id: Number(body.employee_id) }),
      }).then(toProcess),
    getProcess,
    updateProcess: (id, body) =>
      request<BackendProcess>(`/processes/${id}`, { method: "PATCH", body: json(body) }).then(toProcess),
    setCriteria: (id, competency_ids) =>
      request<BackendProcess>(`/processes/${id}/criteria`, {
        method: "PUT",
        body: json({ competency_ids }),
      }).then(toProcess),
    setRating: async (id, indicatorId, body) => {
      await request(`/processes/${id}/ratings/${indicatorId}`, { method: "PUT", body: json(body) });
      return getProcess(id);
    },
    getSummary,
    setDecision: async (id, competencyId, body) => {
      await request(`/processes/${id}/decisions/${competencyId}`, { method: "PUT", body: json(body) });
      return getSummary(id);
    },
    getPdf: (id) => request(`/processes/${id}/pdf`, {}, true),
    getHrProcesses: async (filters) => {
      // backend zna tylko in_progress/completed/overdue – „nierozpoczęte” odfiltrowujemy po stronie klienta
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status === "not_started" ? "in_progress" : filters.status);
      if (filters.unit) params.set("unit", filters.unit);
      if (filters.type) params.set("type", filters.type);
      const qs = params.toString();
      const list = await request<BackendHrProcess[]>(`/hr/processes${qs ? `?${qs}` : ""}`);
      return list.map(toHrProcess).filter((p) => !filters.status || p.status === filters.status);
    },
    sendReminders: async (ids) => {
      const res = await request<{ created: number }>("/hr/reminders", {
        method: "POST",
        body: json({ process_ids: ids.map(Number) }),
      });
      return { sent: res.created };
    },
    ask: (body) =>
      request("/assistant/ask", {
        method: "POST",
        body: json({ ...body, process_id: body.process_id ? Number(body.process_id) : undefined }),
      }),
  };
}


interface BackendEmployee {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  unit: string;
}

interface BackendStatusFields {
  stage: Process["stage"];
  status: "in_progress" | "completed";
  overdue: boolean;
  progress: number;
}

interface BackendProcess extends BackendStatusFields {
  id: number;
  employee: BackendEmployee;
  type: Process["type"];
  form: Process["form"];
  deadline: string | null;
  updated_at: string;
  created_at?: string;
  job_description?: string | null;
  interview_notes?: string | null;
  development_plan?: string | null;
  criteria?: string[];
  ratings?: { indicator_id: string; level: LevelValue | null; example: string | null }[];
}

interface BackendHrProcess extends BackendStatusFields {
  id: number;
  employee_name: string;
  unit: string;
  type: Process["type"];
  form: Process["form"];
  deadline: string | null;
  last_reminder_at: string | null;
}

function toEmployee(e: BackendEmployee): Employee {
  return { id: String(e.id), full_name: `${e.first_name} ${e.last_name}`, position: e.position, unit: e.unit };
}

function toStatus(p: BackendStatusFields): ProcessStatus {
  if (p.status === "completed") return "completed";
  if (p.overdue) return "overdue";
  if (p.stage === "job_description" && p.progress === 0) return "not_started";
  return "in_progress";
}

function toProcess(p: BackendProcess): Process {
  return {
    id: String(p.id),
    employee_id: String(p.employee.id),
    employee_name: `${p.employee.first_name} ${p.employee.last_name}`,
    unit: p.employee.unit,
    type: p.type,
    form: p.form,
    stage: p.stage,
    status: toStatus(p),
    deadline: p.deadline ?? undefined,
    created_at: p.created_at,
    updated_at: p.updated_at,
    job_description: p.job_description ?? undefined,
    interview_notes: p.interview_notes ?? undefined,
    development_plan: p.development_plan ?? undefined,
    competency_ids: p.criteria,
    ratings: p.ratings?.map((r) => ({
      indicator_id: r.indicator_id,
      level: r.level,
      example: r.example ?? undefined,
    })),
  };
}

function toHrProcess(p: BackendHrProcess): Process {
  return {
    id: String(p.id),
    employee_id: "",
    employee_name: p.employee_name,
    unit: p.unit,
    type: p.type,
    form: p.form,
    stage: p.stage,
    status: toStatus(p),
    deadline: p.deadline ?? undefined,
    reminder_sent_at: p.last_reminder_at,
  };
}
