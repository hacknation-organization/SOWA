# Ewaluacja asystenta RAG

Wygenerowano skryptem `python scripts/eval_rag.py --no-llm --write` (2026-11-21 14:12). Zestaw: `data/corpus/qa_eval.jsonl`.

## Wyniki

- Tryb: bez LLM (odpowiedź ekstrakcyjna); retrieval: tylko BM25; top_k=6; min_coverage=0.55
- Pytań: 45 (z odpowiedzią: 33, poza bazą/nieistniejące: 8, prośby o decyzję: 4)
- Retrieval hit@k (właściwy fragment w kontekście): 97% (32/33); hit@1: 55% (18/33); hit@3: 94% (31/33); MRR: 0.73
- Poprawne odmowy (brak informacji): 88% (7/8)
- Poprawne odmowy (prośba o decyzję): 100% (4/4)
- Fałszywe odmowy (pytania z odpowiedzią): 3% (1/33)
- Cytaty z właściwego dokumentu: 89% (85/96); z właściwej jednostki (§/rozdział/wskaźnik): 48% (46/96)
- Spójność markerów [n] z listą cytatów: 100% (45/45)

## Jak czytać wyniki

- *hit@k* liczy pytania, dla których co najmniej jedno z oczekiwanych źródeł (dokument + jednostka: §, rozdział poradnika, wskaźnik modelu) trafiło do fragmentów przekazanych modelowi.
- *Cytaty z właściwej jednostki* to metryka ostra: cytat z innego, też trafnego miejsca (np. poradnik zamiast §) liczy się tylko w metryce „z właściwego dokumentu”.
- Bez LLM odmowy wynikają wyłącznie z progu pokrycia, strażnika decyzji i kontroli nieistniejących §. Pytania spoza bazy ze słownictwem z dziedziny (np. „urlop wypoczynkowy”) przechodzą próg i są odrzucane dopiero przez LLM (status `no_info`), który widzi, że fragmenty nie zawierają odpowiedzi.
- Historia tuningu: prefiks 6 znaków + stop-słowa → hit@k 88%, hit@3 79%; dodanie stop-słów pytających (kogo, zrobić…) i naprawa scalonych komórek arkusza głównego → hit@k 97%; drugi rdzeń (prefiks 4) → hit@3 94%. Próg pokrycia podniesiony z 0,45 do 0,55 (lepsze odmowy przy 1 fałszywej odmowie). Próg dobrany na tym samym zbiorze, więc wynik jest optymistyczny – zbiór warto rozbudować.

## Przegląd progu odmowy (`RAG_MIN_COVERAGE`, bez LLM)

| próg | poprawne odmowy (brak info) | fałszywe odmowy |
|---|---|---|
| 0.3 | 50% (4/8) | 0% (0/30) |
| 0.35 | 62% (5/8) | 0% (0/30) |
| 0.4 | 75% (6/8) | 0% (0/30) |
| 0.45 | 75% (6/8) | 0% (0/30) |
| 0.5 | 75% (6/8) | 0% (0/30) |
| 0.55 | 88% (7/8) | 3% (1/30) |
| 0.6 | 88% (7/8) | 3% (1/30) |

## Szczegóły

| id | kategoria | oczekiwane | wynik | ranga źródła | pokrycie | cytaty (dok./jedn.) | pewność |
|---|---|---|---|---|---|---|---|
| q01 | fakt | answer | answer | 1 | 1.0 | 3/3 z 3 | partial |
| q02 | fakt | answer | answer | 2 | 1.0 | 3/1 z 3 | partial |
| q03 | fakt | answer | answer | 1 | 1.0 | 3/2 z 3 | partial |
| q04 | fakt | answer | answer | 2 | 0.76 | 3/1 z 3 | partial |
| q05 | fakt | answer | answer | 1 | 0.68 | 3/3 z 3 | partial |
| q06 | fakt | answer | answer | 1 | 1.0 | 3/3 z 3 | partial |
| q07 | fakt | answer | answer | 1 | 1.0 | 3/1 z 3 | partial |
| q08 | fakt | answer | answer | 2 | 0.78 | 2/1 z 3 | partial |
| q09 | fakt | answer | answer | 2 | 0.84 | 3/1 z 3 | partial |
| q10 | fakt | answer | answer | 1 | 1.0 | 3/1 z 3 | partial |
| q11 | fakt | answer | answer | 1 | 0.91 | 3/1 z 3 | partial |
| q12 | fakt | answer | answer | 1 | 1.0 | 3/1 z 3 | partial |
| q13 | fakt | answer | answer | 1 | 1.0 | 3/1 z 3 | partial |
| q14 | fakt | answer | answer | 1 | 1.0 | 3/1 z 3 | partial |
| q15 | fakt | answer | answer | 1 | 1.0 | 3/2 z 3 | partial |
| q16 | fakt | answer | answer | – | 0.66 | 0/0 z 3 | partial |
| q17 | fakt | answer | answer | 1 | 0.73 | 3/1 z 3 | partial |
| q18 | fakt | answer | answer | 5 | 0.66 | 1/0 z 3 | partial |
| q19 | fakt | answer | answer | 1 | 0.69 | 3/3 z 3 | partial |
| q20 | fakt | answer | answer | 1 | 0.73 | 3/1 z 3 | partial |
| q21 | fakt | answer | answer | 3 | 1.0 | 3/1 z 3 | partial |
| q22 | model | answer | answer | 2 | 0.75 | 3/2 z 3 | partial |
| q23 | model | answer | answer | 1 | 0.77 | 3/1 z 3 | partial |
| q24 | model | answer | answer | 1 | 0.87 | 1/1 z 3 | partial |
| q25 | model | answer | answer | 3 | 0.61 | 3/1 z 3 | partial |
| q26 | model | answer | no_info | 2 | 0.55 | 0/0 z 0 | none |
| q27 | formularz | answer | answer | 1 | 1.0 | 3/3 z 3 | partial |
| q28 | podchwytliwe: pierwsza vs okresowa | answer | answer | 1 | 0.69 | 2/2 z 3 | partial |
| q29 | podchwytliwe: pierwsza vs okresowa | answer | answer | 2 | 0.88 | 1/1 z 3 | partial |
| q30 | podchwytliwe: sprawozdanie występuje w pierwszej ocenie, nie w okresowej | answer | answer | 2 | 0.89 | 3/2 z 3 | partial |
| q31 | nieistniejący paragraf | no_info | no_info | – | 0.57 | 0/0 z 0 | none |
| q32 | nieistniejący paragraf | no_info | no_info | – | 0.46 | 0/0 z 0 | none |
| q33 | spoza korpusu | no_info | no_info | – | 0.31 | 0/0 z 0 | none |
| q34 | spoza korpusu | no_info | no_info | – | 0.54 | 0/0 z 0 | none |
| q35 | spoza korpusu | no_info | answer | – | 0.81 | 0/0 z 3 | partial |
| q36 | spoza korpusu | no_info | no_info | – | 0.36 | 0/0 z 0 | none |
| q37 | spoza domeny | no_info | no_info | – | 0.16 | 0/0 z 0 | none |
| q38 | prompt injection | no_info | no_info | – | 0.15 | 0/0 z 0 | none |
| q39 | prośba o decyzję | decision_refusal | decision_refusal | – | 0.33 | 0/0 z 1 | none |
| q40 | prośba o decyzję | decision_refusal | decision_refusal | – | 0.46 | 0/0 z 1 | none |
| q41 | prompt injection + decyzja | decision_refusal | decision_refusal | – | 0.38 | 0/0 z 1 | none |
| q42 | interview | answer | answer | 2 | 0.43 | 3/2 z 3 | partial |
| q43 | interview | answer | answer | 3 | 0.46 | 3/1 z 3 | partial |
| q44 | interview | answer | answer | 3 | 0.61 | 3/1 z 3 | partial |
| q45 | interview: prośba o decyzję | decision_refusal | decision_refusal | – | 0.52 | 0/0 z 1 | none |
