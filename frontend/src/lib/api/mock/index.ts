// Klient API w pamięci (tryb bez NEXT_PUBLIC_API_URL).
// Stan jest zapisywany w localStorage, by przetrwał odświeżenie strony.
import { ApiError, type ApiClient } from "../client";
import type {
  Competency,
  CompetencySummary,
  LevelValue,
  Process,
  ProcessStage,
} from "../types";
import { LEVEL_LABELS, STAGES, TYPE_LABELS } from "../types";
import { LEVEL_POINTS, suggestLevel } from "../../domain";
import modelJson from "./competency-model.json";
import { mockAsk } from "./assistant";
import { DEMO_USERS, EMPLOYEES, seedProcesses } from "./data";
import { buildPdf } from "./pdf";

const MODEL = modelJson as Competency[];
const STORE_KEY = "kk.mock.v1";

interface Decision {
  level: LevelValue;
  justification: string;
}

interface Store {
  processes: Process[];
  decisions: Record<string, Record<string, Decision>>;
  seq: number;
}

let store: Store | null = null;

function load(): Store {
  if (store) return store;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORE_KEY) : null;
    if (raw) store = JSON.parse(raw) as Store;
  } catch {
    /* uszkodzony stan – zaczynamy od nowa */
  }
  store ??= { processes: seedProcesses(), decisions: {}, seq: 100 };
  return store;
}

function save() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* tryb prywatny / brak miejsca – stan zostaje tylko w pamięci */
  }
}

const delay = <T,>(value: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));

function decorate(p: Process): Process {
  const e = EMPLOYEES.find((x) => x.id === p.employee_id);
  const overdue =
    p.status !== "completed" && p.deadline != null && new Date(p.deadline).getTime() < Date.now();
  return { ...p, employee_name: e?.full_name, unit: e?.unit, status: overdue ? "overdue" : p.status };
}

function find(id: string): Process {
  const p = load().processes.find((x) => x.id === id);
  if (!p) throw new ApiError(404, "Nie znaleziono procesu oceny");
  return p;
}

function touch(p: Process) {
  p.updated_at = new Date().toISOString();
  if (p.status === "not_started") p.status = "in_progress";
  save();
}

function stageIndex(s: ProcessStage) {
  return STAGES.findIndex((x) => x.id === s);
}

function summary(p: Process): CompetencySummary[] {
  const decisions = load().decisions[p.id] ?? {};
  return (p.competency_ids ?? []).flatMap((cid) => {
    const comp = MODEL.find((c) => c.id === cid);
    if (!comp) return [];
    const ratings = comp.indicators.map((i) => p.ratings?.find((r) => r.indicator_id === i.id));
    const answered = ratings.filter((r) => r !== undefined);
    const levels = answered.map((r) => r!.level);
    const rated = levels.filter((l) => l != null) as LevelValue[];
    const suggested = suggestLevel(levels);
    const noBasis = levels.length - rated.length;
    const missing = comp.indicators.length - answered.length;
    let explanation: string;
    if (suggested == null) {
      explanation = "Brak ocenionych wskaźników – nie można wyliczyć sugerowanego poziomu.";
    } else {
      const sorted = [...rated].sort((a, b) => a - b).join(", ");
      explanation =
        `Mediana z ${rated.length} ocenionych wskaźników (${sorted}) = ${suggested} – „${LEVEL_LABELS[suggested]}”.` +
        (rated.length % 2 === 0 && rated.length > 1 ? " Przy remisie dwóch środkowych wartości wybrano niższą." : "") +
        (noBasis ? ` Pominięto ${noBasis} wskaźn. z oznaczeniem „brak podstaw do oceny”.` : "") +
        (missing ? ` ${missing} wskaźn. nie oceniono.` : "");
    }
    const d = decisions[cid];
    return [
      {
        competency_id: cid,
        rated: rated.length,
        total: comp.indicators.length,
        no_basis: noBasis,
        suggested_level: suggested,
        explanation,
        manager_level: d?.level ?? null,
        justification: d?.justification ?? null,
      },
    ];
  });
}

function pdfLines(p: Process): string[] {
  const e = EMPLOYEES.find((x) => x.id === p.employee_id);
  const lines = [
    "KOMPAS KOMPETENCJI - DOKUMENT DEMONSTRACYJNY (ZASLEPKA)",
    "",
    `${TYPE_LABELS[p.type]}${p.form ? ` - arkusz ${p.form}` : ""}`,
    `Oceniany: ${e?.full_name ?? p.employee_id}, ${e?.position ?? ""}`,
    `Komorka: ${e?.unit ?? ""}`,
    `Data wygenerowania: ${new Date().toLocaleDateString("pl-PL")}`,
    "",
    "OCENY CZASTKOWE",
  ];
  for (const s of summary(p)) {
    const name = MODEL.find((c) => c.id === s.competency_id)?.name ?? s.competency_id;
    const lvl = s.manager_level ?? s.suggested_level;
    lines.push(
      `- ${name}: ${lvl ? `${LEVEL_LABELS[lvl]} (${LEVEL_POINTS[lvl]} pkt)` : "brak oceny"}` +
        (s.manager_level && s.suggested_level && s.manager_level !== s.suggested_level
          ? ` [sugerowany: ${LEVEL_LABELS[s.suggested_level]}]`
          : ""),
    );
    if (s.justification) lines.push(`  Uzasadnienie: ${s.justification}`);
  }
  if (p.interview_notes) lines.push("", "NOTATKI Z ROZMOWY", ...p.interview_notes.split("\n"));
  if (p.development_plan) lines.push("", "PLAN ROZWOJU", ...p.development_plan.split("\n"));
  lines.push("", "Docelowy arkusz zgodny ze wzorem z rozporzadzenia wygeneruje backend.");
  return lines;
}

export function createMockClient(): ApiClient {
  return {
    async login({ username }) {
      const user = DEMO_USERS[username.trim().toLowerCase()];
      if (!user) throw new ApiError(401, "Nieznany użytkownik demonstracyjny");
      return delay({ access_token: `mock-${username}`, ...user });
    },
    getCompetencies: () => delay(MODEL, 50),
    getEmployees: () => delay(EMPLOYEES),
    getProcesses: () => delay(load().processes.map(decorate)),
    async createProcess(body) {
      const s = load();
      const p: Process = {
        id: `p${++s.seq}`,
        employee_id: body.employee_id,
        type: body.type,
        form: body.form,
        stage: "job_description",
        status: "in_progress",
        deadline: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        job_description: "",
        competency_ids: [],
        ratings: [],
      };
      s.processes.unshift(p);
      save();
      return delay(decorate(p));
    },
    getProcess: async (id) => delay(decorate(find(id))),
    async updateProcess(id, body) {
      const p = find(id);
      if (body.job_description !== undefined) p.job_description = body.job_description;
      if (body.form !== undefined) p.form = body.form;
      if (body.interview_notes !== undefined) p.interview_notes = body.interview_notes;
      if (body.development_plan !== undefined) p.development_plan = body.development_plan;
      if (body.stage && stageIndex(body.stage) > stageIndex(p.stage)) p.stage = body.stage;
      if (body.stage === "document") p.status = "completed";
      touch(p);
      return delay(decorate(p));
    },
    async setCriteria(id, competencyIds) {
      const p = find(id);
      p.competency_ids = [...competencyIds];
      touch(p);
      return delay(decorate(p));
    },
    async setRating(id, indicatorId, body) {
      const p = find(id);
      p.ratings = (p.ratings ?? []).filter((r) => r.indicator_id !== indicatorId);
      p.ratings.push({ indicator_id: indicatorId, level: body.level, example: body.example });
      touch(p);
      return delay(decorate(p), 40);
    },
    getSummary: async (id) => delay(summary(find(id))),
    async setDecision(id, competencyId, body) {
      const p = find(id);
      const s = load();
      s.decisions[id] ??= {};
      s.decisions[id][competencyId] = { level: body.level, justification: body.justification };
      touch(p);
      return delay(summary(p));
    },
    getPdf: async (id) => delay(null, 300).then(() => buildPdf(pdfLines(find(id)))),
    async getHrProcesses(filters) {
      const list = load()
        .processes.map(decorate)
        .filter((p) => !filters.status || p.status === filters.status)
        .filter((p) => !filters.unit || p.unit === filters.unit)
        .filter((p) => !filters.type || p.type === filters.type);
      return delay(list);
    },
    async sendReminders(ids) {
      const now = new Date().toISOString();
      for (const id of ids) find(id).reminder_sent_at = now;
      save();
      return delay({ sent: ids.length });
    },
    async ask(body) {
      const p = body.process_id ? load().processes.find((x) => x.id === body.process_id) : undefined;
      return delay(mockAsk(body, p, MODEL), 500);
    },
  };
}
