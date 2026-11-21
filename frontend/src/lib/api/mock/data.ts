// Dane demonstracyjne trybu mock. Osoby są fikcyjne.
import type { Employee, Process, Role } from "../types";

export const DEMO_USERS: Record<string, { role: Role; display_name: string }> = {
  przelozony: { role: "przelozony", display_name: "Anna Kowalska (naczelniczka wydziału)" },
  hr: { role: "hr", display_name: "Marek Nowak (biuro kadr)" },
  admin: { role: "admin", display_name: "Administrator systemu" },
};

export const EMPLOYEES: Employee[] = [
  { id: "e1", full_name: "Jan Wiśniewski", position: "starszy specjalista", unit: "Departament Cyberbezpieczeństwa", hired_at: "2019-03-01" },
  { id: "e2", full_name: "Katarzyna Zielińska", position: "radca", unit: "Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji", hired_at: "2017-09-15" },
  { id: "e3", full_name: "Piotr Lewandowski", position: "naczelnik wydziału", unit: "Departament Współpracy Międzynarodowej", hired_at: "2015-01-10" },
  { id: "e4", full_name: "Magdalena Wójcik", position: "specjalista", unit: "Departament Cyberbezpieczeństwa", hired_at: "2026-02-01" },
  { id: "e5", full_name: "Tomasz Kamiński", position: "główny specjalista", unit: "Departament Współpracy Międzynarodowej", hired_at: "2020-06-01" },
  { id: "e6", full_name: "Agnieszka Dąbrowska", position: "referent", unit: "Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji", hired_at: "2026-05-04" },
  { id: "e7", full_name: "Michał Szymański", position: "starszy specjalista", unit: "Departament Cyberbezpieczeństwa", hired_at: "2018-11-12" },
];

function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function seedProcesses(): Process[] {
  return [
    {
      id: "p1", employee_id: "e1", type: "periodic", form: "C", stage: "assessment", status: "in_progress",
      deadline: inDays(12), created_at: inDays(-10), updated_at: inDays(-1),
      job_description: "", competency_ids: ["K03", "K01", "K04", "K06", "K02", "K11"],
      ratings: [
        { indicator_id: "K03-W1", level: 3, example: "Przygotował analizę ryzyk do krajowego planu reagowania." },
        { indicator_id: "K03-W2", level: 4 },
        { indicator_id: "K03-W3", level: null },
      ],
    },
    {
      id: "p2", employee_id: "e3", type: "periodic", form: "B", stage: "job_description", status: "not_started",
      deadline: inDays(30), created_at: inDays(-2), updated_at: inDays(-2), competency_ids: [], ratings: [],
    },
    {
      id: "p3", employee_id: "e4", type: "first", form: null, stage: "criteria", status: "in_progress",
      deadline: inDays(5), created_at: inDays(-20), updated_at: inDays(-3), competency_ids: [], ratings: [],
    },
    {
      id: "p4", employee_id: "e5", type: "periodic", form: "C", stage: "document", status: "completed",
      deadline: inDays(-15), created_at: inDays(-60), updated_at: inDays(-16), competency_ids: [], ratings: [],
    },
    {
      id: "p5", employee_id: "e7", type: "periodic", form: "C", stage: "criteria", status: "overdue",
      deadline: inDays(-4), created_at: inDays(-45), updated_at: inDays(-30), competency_ids: [], ratings: [],
    },
    {
      id: "p6", employee_id: "e6", type: "first", form: null, stage: "job_description", status: "not_started",
      deadline: inDays(60), created_at: inDays(-1), updated_at: inDays(-1), competency_ids: [], ratings: [],
    },
  ];
}
