# Asystent RAG – Kompas kompetencji

Moduł odpowiada na pytania przełożonych **wyłącznie na podstawie bazy wiedzy**. Każdą odpowiedź opatruje cytatami źródeł, a gdy nie ma podstaw, mówi to wprost. **Nigdy nie wskazuje poziomu oceny konkretnego pracownika.**

## Interfejs (kontrakt z backendem)

```python
from app.rag.service import ask

result = await ask(question: str, mode: str, context: dict | None = None)
# {"answer": str,
#  "citations": [{"marker": int, "source": str, "path": str, "page": int | None, "excerpt": str}],
#  "confidence": "high" | "partial" | "none"}
```

- `mode="formal"` – zasady i wymagania formalne. `context` jest opcjonalny; brane jest z niego tylko `context["process"]` (`"pierwsza"` lub `"okresowa"`), które ustala priorytet źródeł.
- `mode="interview"` – przygotowanie rozmowy: pytania, tematy, argumenty, plan rozwoju. `context` to **zanonimizowane** wyniki procesu. Schemat jest luźny, a rozpoznawane klucze to:

```json
{"process": "okresowa", "sheet": "C",
 "competencies": [{"name": "KOMUNIKACJA",
                   "indicators": [{"name": "Formułowanie jasnych i precyzyjnych wypowiedzi pisemnych",
                                   "observed_behaviors": ["Pisma wymagają kilku poprawek"],
                                   "supervisor_level": "poniżej oczekiwań"}]}],
 "decisions": {"final_level_decided_by_supervisor": "na poziomie oczekiwań"}}
```

Klucze identyfikujące osobę (`imie`, `nazwisko`, `email`, `pesel`, `telefon`, …) są usuwane przed wysłaniem do LLM. E-maile, numery PESEL i telefony w tekstach są maskowane (`guards.scrub_context`).

- `marker` w `citations` odpowiada znacznikom `[n]` w `answer`. Numeracja jest zawsze ciągła od 1.
- `confidence`: `high` oznacza pełną odpowiedź z mocnym dopasowaniem źródeł. `partial` oznacza odpowiedź częściową, słabsze dopasowanie albo tryb bez LLM (odpowiedź ekstrakcyjna). `none` oznacza odmowę: brak informacji albo prośbę o decyzję.

Integracja w FastAPI to jedna linia: `return await ask(body.question, body.mode, body.context)`. Indeks ładuje się leniwie przy pierwszym wywołaniu (około 1 s). Po przebudowie indeksu wywołaj `app.rag.service.reset_service()`.

## Budowa indeksu

```bash
cd backend
python scripts/ingest.py            # szuka docs/HackNation w katalogach nadrzędnych
python scripts/ingest.py --docs ../docs/HackNation --no-embed
```

Skrypt tworzy:

- `data/corpus/chunks.jsonl` – chunki. Plik jest **w repozytorium**, bo `docs/` jest w `.gitignore`, a indeks ma działać bez oryginalnych plików.
- `data/corpus/embeddings.npy` i `embeddings.meta.json` – tylko gdy ustawiony jest `GEMINI_API_KEY`. Bez tych plików retrieval działa na samym BM25.

Metadane chunka: `id, source, source_id, doc_type (rozporzadzenie|poradnik|model|formularz|qa), path, page, applies_to (pierwsza|okresowa|oba), text`. Pole `text` zaczyna się prefiksem `[źródło | ścieżka]`, dzięki czemu wyszukiwarka i LLM znają kontekst fragmentu.

| źródło | chunkowanie | chunki |
|---|---|---|
| Rozporządzenie o pierwszej ocenie (2015) | po § (długie § po ustępach); zał. 1 po elemencie oceny; zał. 3 (sprawozdanie) | 21 |
| Rozporządzenie o ocenach okresowych (2016) | po §; zał. 1 po kryterium; zał. 2 (arkusz A) | 37 |
| Poradnik „Pierwsza ocena…” (2016) | po nagłówkach ze spisu treści, okna 300–600 tokenów z zakładką 1 zdania | 62 |
| Poradnik „Oceny okresowe…” (2016) | jw. | 64 |
| `Model_kompetencji.xlsx` | zasady z arkusza głównego + lista wskaźników na kompetencję + **1 chunk na wskaźnik** (5 poziomów) | 64 |
| Arkusze `.docx` (pierwsza, B, C) | sekcje formularza + przypisy (objaśnienia wypełniania) | 16 |

Uwagi do korpusu:

- Wszystkie PDF-y mają warstwę tekstu (to nie skany), OCR nie był potrzebny.
- Rozporządzenie o ocenach okresowych występuje w paczce dwa razy, ale **kopie nie są identyczne**. Kopia „(3)” to pełny akt (19 stron). Kopia „(4)” z folderu OSP to 3-stronicowy wyciąg z załącznika nr 1 ze znakiem wodnym. Indeksowana jest tylko kopia „(3)”, a treść „(4)” w całości się w niej zawiera.
- Arkusze B i C oraz arkusz pierwszej oceny są indeksowane z `.docx`, bo dają czystszy tekst i przypisy. Odpowiednie załączniki PDF są pomijane, żeby nie dublować treści. Arkusz A (zał. 2 do rozporządzenia z 2016 r.) nie ma wersji `.docx`, więc pochodzi z PDF.
- `OSP_word.zip` celowo **nie** należy do korpusu czatu.

## Jak działa odpowiedź

1. **Strażnik decyzji** (`guards.is_decision_request`). Pytania typu „jaką ocenę mam wystawić…”, „czy zasługuje na…” czy „przyznaj…” dostają stałą odmowę z cytatem zasad skali ocen. LLM nie jest wtedy wywoływany.
2. **Nieistniejące przepisy.** Pytanie o „§ 25”, którego nie ma w żadnym rozporządzeniu, kończy się odmową bez wywołania LLM.
3. **Retrieval hybrydowy** (`retrieval.py`):
   - BM25 na tokenach bez polskich znaków, z dwoma rdzeniami (prefiks 6 i 4 znaków) i tokenami odwołań (`par5`, `ust2`, `art81`);
   - kosinus na embeddingach Gemini (`gemini-embedding-001`, 768 wymiarów), jeśli są;
   - fuzja **RRF** (k=60), top-k=6;
   - fragmenty z drugiej ścieżki (pierwsza vs okresowa, ustalonej z `context.process` lub z treści pytania) dostają karę ×0,55, więc nie są wycinane, tylko spadają w rankingu.
4. **Próg odmowy.** Liczone jest *pokrycie zapytania*: jaką część ważonej IDF masy terminów pytania zawiera najlepszy fragment. Terminy nieobecne w korpusie mają maksymalne IDF. Gdy pokrycie < `RAG_MIN_COVERAGE` (0,55, wartość dobrana na `qa_eval.jsonl`, patrz EVAL.md), a kosinus nie ratuje sytuacji, odpowiedź brzmi **„W bazie wiedzy nie znalazłem informacji na ten temat.”**, bez wywołania LLM.
5. **Generacja** (Gemini `gemini-3.5-flash`, a przy błędzie lub limicie Groq `llama-3.3-70b-versatile`):
   - prompt wymusza odpowiedź wyłącznie z fragmentów, markery `[n]` i JSON `{status, answer, used_markers}`; Gemini dostaje `responseSchema`;
   - status `no_info` daje komunikat o braku informacji, a `refuse_decision` daje odmowę decyzji.
6. **Walidacja po stronie serwera** (`service.validate_citations`):
   - z odpowiedzi usuwane są markery spoza `1..k` (np. zmyślone `[9]`), a pozostałe są przenumerowane;
   - odpowiedź w trybie `formal` bez żadnego poprawnego cytatu jest traktowana jak nieuziemiona i zamieniana na „brak informacji”;
   - dodatkowy filtr wychwytuje sformułowania przesądzające ocenę („powinien otrzymać ocenę…”).
7. **Prompt injection.** Fragmenty, kontekst i pytanie trafiają do oznaczonych sekcji (`<fragmenty>`, `<dane_oceny>`, `<pytanie>`), a prompt nazywa je danymi. Znaczniki sekcji są wycinane z treści danych, więc dane nie mogą zamknąć sekcji. Nawet gdy model da się zmanipulować, walidacja cytatów i strażnik decyzji działają niezależnie od niego.
8. **Bez klucza lub przy awarii LLM** zwracana jest odpowiedź ekstrakcyjna: 3 najlepsze fragmenty z cytatami, `confidence="partial"`. Demo działa bez sieci.

## Zmienne środowiskowe

| zmienna | domyślnie | opis |
|---|---|---|
| `RAG_LLM` | – (= `gemini,groq`) | łańcuch `dostawca:model` po przecinku, np. `anthropic:claude-opus-5-5,groq`; dostawcy: `gemini`, `anthropic`, `groq`, `openai`, `openrouter`, `ollama` |
| `GEMINI_API_KEY` (lub `GOOGLE_API_KEY`) | – | generacja i embeddingi (free tier AI Studio) |
| `GROQ_API_KEY` | – | Groq (free tier) |
| `ANTHROPIC_API_KEY` | – | Claude (domyślny model `claude-opus-5-5`); `RAG_ANTHROPIC_EFFORT` ustawia effort |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` | –, `https://api.openai.com/v1` | OpenAI lub inny serwer zgodny z API OpenAI (model trzeba podać) |
| `OPENROUTER_API_KEY` | – | OpenRouter, w tym darmowe modele `…:free` (model trzeba podać) |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | lokalna Ollama, bez klucza (model trzeba podać) |
| `RAG_GEMINI_MODEL` | `gemini-3.5-flash` | model generacji |
| `RAG_GEMINI_EMBED_MODEL` | `gemini-embedding-001` | model embeddingów (po zmianie przebuduj indeks) |
| `RAG_EMBED_DIM` | `768` | wymiar embeddingów |
| `RAG_GROQ_MODEL` | `llama-3.3-70b-versatile` | model Groq |
| `RAG_TOP_K` | `6` | liczba fragmentów w kontekście (tryb interview dokłada do 8 z modelu kompetencji) |
| `RAG_MIN_COVERAGE` | `0.55` | próg odmowy (pokrycie zapytania) |
| `RAG_MIN_COSINE` | `0.62` | alternatywny próg dla embeddingów (do skalibrowania po zbudowaniu embeddingów) |
| `RAG_CORPUS_DIR` | `backend/data/corpus` | katalog indeksu |
| `RAG_LLM_TIMEOUT` | `40` | timeout wywołania LLM [s] |

Klucz Gemini jest wysyłany w nagłówku `x-goog-api-key`, nie w URL. Logi (`app.rag`) zawierają tylko tryb, wynik, liczbę fragmentów i czas, **bez treści pytań i kontekstu**.

## Testy i ewaluacja

```bash
cd backend
python -m pytest tests/rag            # bez sieci (atrapa LLM)
python scripts/eval_rag.py --no-llm --sweep --write   # retrieval + progi, zapisuje app/rag/EVAL.md
python scripts/eval_rag.py --write                    # pełny pipeline z LLM (wymaga klucza)
```

## Luki w bazie wiedzy

- **Brak ustawy o służbie cywilnej**, choć zadanie wymienia ją w bazie wiedzy. Poradniki i arkusze powołują się na nią (art. 35, 38, 71, 81, 83, 89, 108), więc asystent zna te artykuły tylko pośrednio, z omówień. Na pytania o dosłowną treść ustawy odpowie, że brak informacji. Do uzupełnienia: wyciąg z ustawy z ISAP jako kolejne źródło `rozporzadzenie`-podobne. W `extract.SOURCES` wystarczy dodać wpis.
- **Brak zbioru Q&A** (typ `qa` jest obsługiwany, ale pusty). Dobrym uzupełnieniem byłyby zatwierdzone przez BDG odpowiedzi na najczęstsze pytania.
- Poradniki pochodzą z 2016 r. i warto potwierdzić u organizatora, czy są aktualne.

## Przed produkcją

- **Hosting i model:** dane z procesu oceny (nawet zanonimizowane) nie powinny trafiać do publicznych API spoza UE. Docelowo potrzebny jest model w regionie UE z umową powierzenia (np. Vertex AI z `europe-*` i wyłączonym użyciem danych do trenowania) albo **model on-prem** (Bielik, Llama lub Mistral przez vLLM/Ollama). `llm.py` ma wąski interfejs `generate_json`, więc kolejny dostawca to jedna klasa. Embeddingi też lokalnie (np. `multilingual-e5`), po zmianie przebudowa indeksu.
- **Free tier Gemini/Groq jest tylko na hackathon.** W free tier dostawca może wykorzystywać dane wejściowe, a limity zapytań są niskie.
- **Logi bez danych osobowych:** zostawić obecną politykę (metadane bez treści). Nie włączać logowania promptów w bramce LLM. Retencja i dostęp do logów zgodnie z RODO.
- **Minimalizacja danych:** frontend lub backend powinien wysyłać w `context` wyłącznie dane potrzebne do rozmowy (kompetencje, zachowania, decyzje), bez identyfikatorów. `scrub_context` jest drugą linią obrony, nie pierwszą.
- **Kontrola jakości:** uruchamiać `eval_rag.py` po każdej zmianie korpusu lub modelu i rozbudować `qa_eval.jsonl` o pytania zgłaszane przez użytkowników. Rozważyć log oceny odpowiedzi (kciuk w górę/w dół) bez treści.
- **Indeks:** przy większym korpusie przenieść embeddingi do pgvector (kolumny jak w `chunks.jsonl` plus `vector(768)`) i dodać wersjonowanie korpusu (data aktu, źródło ISAP).
- **Rate limiting i kontrola dostępu** do endpointu czatu (rola przełożonego lub HR). Limit długości pytania (2000 znaków) i kontekstu (12 000 znaków) już jest.
