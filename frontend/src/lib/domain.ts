import type { FormType, LevelValue, ProcessType } from "./api/types";

export const MANDATORY_CRITERIA: Record<FormType, string[]> = {
  B: ["K13", "K14", "K04", "K06", "K02"],
  C: ["K03", "K01", "K04", "K06", "K02"],
};

export const MAX_ADDITIONAL_CRITERIA = 3;

export const FORM_DESCRIPTIONS: Record<FormType, string> = {
  B: "Arkusz B – dla osób kierujących pracą innych (kryteria obowiązkowe: zarządzanie ludźmi, podejmowanie decyzji, organizacja pracy, współpraca, komunikacja).",
  C: "Arkusz C – dla pozostałych stanowisk (kryteria obowiązkowe: wykorzystywanie wiedzy, rzetelność, organizacja pracy, współpraca, komunikacja).",
};

export const LEVEL_POINTS: Record<LevelValue, number> = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 9 };

export function mandatoryCriteria(type: ProcessType, form: FormType | null): string[] {
  if (type !== "periodic" || !form) return [];
  return MANDATORY_CRITERIA[form];
}

export function suggestLevel(levels: (LevelValue | null)[]): LevelValue | null {
  const rated = levels.filter((l): l is LevelValue => l != null).sort((a, b) => a - b);
  if (rated.length === 0) return null;
  return rated[Math.floor((rated.length - 1) / 2)];
}
