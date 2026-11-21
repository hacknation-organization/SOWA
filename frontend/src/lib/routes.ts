import type { ProcessType } from "./api/types";

export const ROUTES = {
  dashboard: "/",
  login: "/login",
  assessments: "/assessments",
  newAssessment: "/assessments/new",
  hr: "/hr",
  assistant: "/assistant",
} as const;

export function assessmentPath(id: string): string {
  return `${ROUTES.assessments}/${id}`;
}

export function newAssessmentPath(type: ProcessType): string {
  return `${ROUTES.newAssessment}?type=${type}`;
}
