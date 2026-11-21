// Zaślepka asystenta RAG: dopasowanie słów kluczowych do krótkiej bazy fragmentów.
// Prawdziwy asystent (backend /assistant/ask) zastąpi ten moduł bez zmian w UI.
import type { AskRequest, AskResponse, Citation, Competency, Process } from "../types";
import { LEVEL_LABELS } from "../types";

const SRC_B = {
  source: "Wzór arkusza B – ocena okresowa (załącznik nr 3 do rozporządzenia z 2016 r.)",
  path: "docs/HackNation/Ocena okresowa w służbie cywilnej/Arkusz oceny B (2).docx",
};
const SRC_C = {
  source: "Wzór arkusza C – ocena okresowa (załącznik nr 4 do rozporządzenia z 2016 r.)",
  path: "docs/HackNation/Ocena okresowa w służbie cywilnej/Arkusz oceny C (2).docx",
};
const SRC_MODEL = {
  source: "Model kompetencji – służba cywilna",
  path: "docs/HackNation/Model_kompetencji.xlsx",
};

interface Entry {
  keywords: string[];
  answer: string;
  citations: Omit<Citation, "marker">[];
}

const KB: Entry[] = [
  {
    keywords: ["arkusz b", "kierownicz", "kryteria obowiązkowe b"],
    answer:
      "Arkusz B stosuje się przy ocenie okresowej osób kierujących pracą innych. Kryteria obowiązkowe to: zarządzanie ludźmi, podejmowanie decyzji i odpowiedzialność, organizacja pracy i orientacja na osiąganie celów, współpraca oraz komunikacja [1]. Oceniający może wybrać nie więcej niż 3 kryteria dodatkowe [1].",
    citations: [
      {
        ...SRC_B,
        page: 1,
        excerpt:
          "Kryteria obowiązkowe: Zarządzanie ludźmi, Podejmowanie decyzji i odpowiedzialność, Organizacja pracy i orientacja na osiąganie celów, Współpraca, Komunikacja. Kryteria dodatkowe wybrane przez oceniającego (nie więcej niż 3).",
      },
    ],
  },
  {
    keywords: ["arkusz c", "kryteria obowiązkowe", "kryteria dodatkowe", "ile kryteriów"],
    answer:
      "W arkuszu C kryteria obowiązkowe to: wykorzystywanie wiedzy i doskonalenie zawodowe, rzetelność, organizacja pracy i orientacja na osiąganie celów, współpraca oraz komunikacja [1]. W obu arkuszach (B i C) oceniający wybiera dodatkowo nie więcej niż 3 kryteria [1][2].",
    citations: [
      {
        ...SRC_C,
        page: 1,
        excerpt:
          "Kryteria obowiązkowe: Wykorzystywanie wiedzy i doskonalenie zawodowe, Rzetelność, Organizacja pracy i orientacja na osiąganie celów, Współpraca, Komunikacja. Kryteria dodatkowe wybrane przez oceniającego (nie więcej niż 3).",
      },
      {
        ...SRC_B,
        page: 1,
        excerpt: "Kryteria dodatkowe wybrane przez oceniającego (nie więcej niż 3).",
      },
    ],
  },
  {
    keywords: ["punkt", "skala", "ocena cząstkowa", "poziom"],
    answer:
      "Ocena cząstkowa w arkuszach ma pięć poziomów punktowanych: znacznie poniżej oczekiwań – 1 pkt, poniżej oczekiwań – 3 pkt, na poziomie oczekiwań – 5 pkt, powyżej oczekiwań – 7 pkt, znacznie powyżej oczekiwań – 9 pkt [1]. Te same nazwy poziomów stosuje model kompetencji przy opisach zachowań [2].",
    citations: [
      {
        ...SRC_C,
        page: 2,
        excerpt:
          "Ocena cząstkowa: Znacznie poniżej oczekiwań 1 punkt, Poniżej oczekiwań 3 punkty, Na poziomie oczekiwań 5 punktów, Powyżej oczekiwań 7 punktów, Znacznie powyżej oczekiwań 9 punktów.",
      },
      {
        ...SRC_MODEL,
        page: null,
        excerpt: "14 kompetencji • 49 wskaźników behawioralnych • 5 poziomów oceny.",
      },
    ],
  },
  {
    keywords: ["rozmow", "zapoznanie"],
    answer:
      "Oceniający i oceniany potwierdzają w arkuszu przeprowadzenie rozmowy, o której mowa w § 5 ust. 1 rozporządzenia z 4 kwietnia 2016 r., omówienie w jej trakcie wszystkich wymaganych zagadnień oraz zapoznanie ocenianego z kryteriami i terminem sporządzenia oceny [1].",
    citations: [
      {
        ...SRC_B,
        page: 1,
        excerpt:
          "Potwierdzamy: przeprowadzenie rozmowy, o której mowa w § 5 ust. 1 rozporządzenia (…) i omówienie w trakcie tej rozmowy wszystkich wymaganych zagadnień, zapoznanie ocenianego z kryteriami oceny oraz terminem sporządzenia oceny.",
      },
    ],
  },
  {
    keywords: ["brak podstaw", "nie zaobserw", "brak okazji"],
    answer:
      "Model kompetencji zaleca, by ocenę opierać na konkretnych przykładach z ocenianego okresu, a jeśli nie było okazji do zaobserwowania zachowania – nie oceniać danego wskaźnika [1]. W aplikacji służy do tego opcja „brak podstaw do oceny”; takie wskaźniki nie wchodzą do wyliczenia sugerowanego poziomu.",
    citations: [
      {
        ...SRC_MODEL,
        page: null,
        excerpt:
          "Oprzyj ocenę na konkretnych przykładach z ocenianego okresu. Jeśli brak było okazji do zaobserwowania zachowania…",
      },
    ],
  },
];

function withMarkers(cits: Omit<Citation, "marker">[]): Citation[] {
  return cits.map((c, i) => ({ ...c, marker: `[${i + 1}]` }));
}

function formal(question: string): AskResponse {
  const q = question.toLocaleLowerCase("pl-PL");
  const hits = KB.filter((e) => e.keywords.some((k) => q.includes(k)));
  if (hits.length === 0) {
    return {
      answer:
        "Nie znalazłem w bazie wiedzy informacji, które pozwalają odpowiedzieć na to pytanie. Nie podam odpowiedzi bez oparcia w źródłach – skontaktuj się z komórką kadr lub sprawdź bezpośrednio ustawę o służbie cywilnej i rozporządzenia.",
      citations: [],
      confidence: "none",
    };
  }
  const best = hits[0];
  return {
    answer: best.answer,
    citations: withMarkers(best.citations),
    confidence: hits.length > 1 || best.citations.length > 1 ? "high" : "partial",
  };
}

function interview(process: Process | undefined, model: Competency[]): AskResponse {
  if (!process || !process.competency_ids?.length) {
    return {
      answer:
        "Aby przygotować rozmowę, wybierz najpierw kryteria i oceń wskaźniki – wtedy zaproponuję pytania i tematy dopasowane do wyników.",
      citations: [],
      confidence: "none",
    };
  }
  const byId = new Map(model.flatMap((c) => c.indicators.map((i) => [i.id, { c, i }] as const)));
  const ratings = (process.ratings ?? []).filter((r) => r.level != null);
  const low = ratings.filter((r) => (r.level ?? 0) <= 2);
  const high = ratings.filter((r) => (r.level ?? 0) >= 4);
  const lines: string[] = ["Propozycja przebiegu rozmowy oceniającej:", "", "Pytania otwierające:"];
  lines.push("• Co w minionym okresie uważasz za swoje najważniejsze osiągnięcie i dlaczego?");
  lines.push("• Które zadania sprawiały ci najwięcej trudności i czego potrzebowałeś, by je wykonać?");
  if (high.length) {
    lines.push("", "Mocne strony do docenienia:");
    for (const r of high.slice(0, 3)) {
      const m = byId.get(r.indicator_id);
      if (m) lines.push(`• ${m.c.name}: ${m.i.name} – poziom „${LEVEL_LABELS[r.level!]}”${r.example ? ` (przykład: ${r.example})` : ""}.`);
    }
  }
  if (low.length) {
    lines.push("", "Obszary do omówienia (z prośbą o perspektywę pracownika):");
    for (const r of low.slice(0, 3)) {
      const m = byId.get(r.indicator_id);
      if (m) lines.push(`• ${m.i.name} – jak oceniasz swoje działania w tym obszarze? Co mogłoby pomóc?`);
    }
  }
  lines.push("", "Propozycja planu rozwoju:");
  const target = low[0] ?? ratings.find((r) => r.level === 3);
  const tm = target && byId.get(target.indicator_id);
  if (tm) {
    const next = tm.i.levels.find((l) => l.level === Math.min(5, (target!.level ?? 3) + 1));
    lines.push(`• Cel: ${tm.c.name.toLocaleLowerCase("pl-PL")} – zachowanie docelowe: „${next?.description ?? ""}”.`);
    lines.push("• Działania: zadanie rozwojowe w bieżącej pracy, wsparcie mentora, szkolenie tematyczne.");
    lines.push("• Termin przeglądu: za 6 miesięcy.");
  } else {
    lines.push("• Uzgodnij z pracownikiem 1–2 cele rozwojowe powiązane z zadaniami z OSP.");
  }
  return {
    answer: lines.join("\n"),
    citations: withMarkers([
      {
        ...SRC_MODEL,
        page: null,
        excerpt: tm
          ? `${tm.i.name} – opisy poziomów zachowań.`
          : "Dobierz wskaźniki do zadań i zakresu odpowiedzialności na stanowisku.",
      },
    ]),
    confidence: "partial",
  };
}

export function mockAsk(body: AskRequest, process: Process | undefined, model: Competency[]): AskResponse {
  return body.mode === "interview" ? interview(process, model) : formal(body.question);
}
