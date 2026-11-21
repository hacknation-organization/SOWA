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

  return {
    login: (body) => request("/auth/login", { method: "POST", body: json(body) }),
    getCompetencies: () => request("/competencies"),
    getEmployees: () => request("/employees"),
    getProcesses: () => request("/processes"),
    createProcess: (body) => request("/processes", { method: "POST", body: json(body) }),
    getProcess: (id) => request(`/processes/${id}`),
    updateProcess: (id, body) => request(`/processes/${id}`, { method: "PATCH", body: json(body) }),
    setCriteria: (id, competency_ids) =>
      request(`/processes/${id}/criteria`, { method: "PUT", body: json({ competency_ids }) }),
    setRating: (id, indicatorId, body) =>
      request(`/processes/${id}/ratings/${indicatorId}`, { method: "PUT", body: json(body) }),
    getSummary: (id) => request(`/processes/${id}/summary`),
    setDecision: (id, competencyId, body) =>
      request(`/processes/${id}/decisions/${competencyId}`, { method: "PUT", body: json(body) }),
    getPdf: (id) => request(`/processes/${id}/pdf`, {}, true),
    getHrProcesses: (filters) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, String(v));
      const qs = params.toString();
      return request(`/hr/processes${qs ? `?${qs}` : ""}`);
    },
    sendReminders: (process_ids) =>
      request("/hr/reminders", { method: "POST", body: json({ process_ids }) }),
    ask: (body) => request("/assistant/ask", { method: "POST", body: json(body) }),
  };
}
