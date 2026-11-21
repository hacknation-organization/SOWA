// Reguły dziedzinowe niezależne od trybu API (mock / backend).
import type { FormType, LevelValue, ProcessType } from "./api/types";

/** Kryteria obowiązkowe wg wzorów arkuszy B i C (rozporządzenie z 2016 r.). */
export const MANDATORY_CRITERIA: Record<FormType, string[]> = {
  // Arkusz B – stanowiska kierownicze
  B: ["K13", "K14", "K04", "K06", "K02"],
  // Arkusz C – pozostałe stanowiska
  C: ["K03", "K01", "K04", "K06", "K02"],
};

/** Maksymalna liczba kryteriów dodatkowych wybieranych przez oceniającego. */
export const MAX_ADDITIONAL_CRITERIA = 3;

export const FORM_DESCRIPTIONS: Record<FormType, string> = {
  B: "Arkusz B – dla osób kierujących pracą innych (kryteria obowiązkowe: zarządzanie ludźmi, podejmowanie decyzji, organizacja pracy, współpraca, komunikacja).",
  C: "Arkusz C – dla pozostałych stanowisk (kryteria obowiązkowe: wykorzystywanie wiedzy, rzetelność, organizacja pracy, współpraca, komunikacja).",
};

/** Punkty oceny cząstkowej w arkuszach B/C. */
export const LEVEL_POINTS: Record<LevelValue, number> = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 9 };

export function mandatoryCriteria(type: ProcessType, form: FormType | null): string[] {
  if (type !== "periodic" || !form) return [];
  return MANDATORY_CRITERIA[form];
}

/**
 * Sugerowany poziom: mediana ocenionych wskaźników (null = „brak podstaw” pomijane).
 * Przy parzystej liczbie ocen (remis dwóch środkowych wartości) wybierany jest niższy poziom.
 */
export function suggestLevel(levels: (LevelValue | null)[]): LevelValue | null {
  const rated = levels.filter((l): l is LevelValue => l != null).sort((a, b) => a - b);
  if (rated.length === 0) return null;
  return rated[Math.floor((rated.length - 1) / 2)];
}
