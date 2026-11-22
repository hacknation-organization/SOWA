# Kompas kompetencji – backend (FastAPI)

API dla aplikacji wspierającej przełożonych w służbie cywilnej w **pierwszej ocenie** i **ocenie okresowej**
(arkusze B/C) na podstawie modelu kompetencji (14 kompetencji, 49 wskaźników, 5 poziomów).

**Zasada:** AI nigdy nie decyduje o poziomie oceny. Sugerowany poziom kompetencji liczy deterministyczny
kod (`app/domain/scoring.py`): mediana ocenionych wskaźników, z pominięciem „brak podstaw do oceny”,
przy remisie – wartość niższa. Ostateczny poziom ustala przełożony; odejście od sugestii wymaga uzasadnienia.

## Uruchomienie (dev, SQLite)

Wymagania: Python 3.12 i [uv](https://docs.astral.sh/uv/).

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

- API: http://localhost:8000/api, dokumentacja OpenAPI: http://localhost:8000/docs
- Przy pierwszym starcie tworzone są tabele (`backend/kompas.db`) i ładowane dane demo
  (wyłączenie: `SEED_DEMO_DATA=false`). CORS dopuszcza `http://localhost:3000`.
- Konfiguracja: skopiuj `.env.example` do `.env` (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`).

### Użytkownicy demo (hasło `demo123`, dane fikcyjne)

| login | rola | uwagi |
| --- | --- | --- |
| `przelozony` | przelozony | 5 podwładnych, 3 procesy (nowy B, pierwsza ocena w trakcie, C po terminie) |
| `przelozony2` | przelozony | 2 podwładnych, 1 zakończony proces B |
| `hr` | hr | monitoring wszystkich procesów, przypomnienia |
| `admin` | admin | pełny dostęp |

### Baza i dane

```bash
uv run python scripts/seed.py           # utworzenie tabel + dane demo (jeśli baza pusta)
uv run python scripts/seed.py --reset   # odtworzenie bazy od zera
uv run python scripts/import_competency_model.py [ścieżka/do/Model_kompetencji.xlsx]
```

Import modelu czyta `docs/HackNation/Model_kompetencji.xlsx` (szuka też w repozytorium nadrzędnym) i zapisuje
`data/competency_model.json` (wersjonowany w repo, więc import trzeba powtórzyć tylko po zmianie arkusza).
Skrypt weryfikuje liczby 14 kompetencji / 49 wskaźników. Identyfikatory: kompetencje `K01`–`K14`,
wskaźniki `K01-W1` … (kolejność jak w arkuszu).

Schemat tworzy `SQLModel.metadata.create_all` (prototyp; Alembic jest w zależnościach na potrzeby
przyszłych migracji).

### Supabase (projekt SOWA)

Domyślna baza w `.env` to Postgres w Supabase (projekt `SOWA`, `eu-west-1`), przez **session pooler**
(IPv4; host bezpośredni `db.<ref>.supabase.co` jest tylko IPv6):

```
DATABASE_URL=postgresql+psycopg://postgres.mnpzkrwmnezmwvqldupq:<HASLO_DB>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
```

- Hasło: Supabase → Project Settings → Database (w razie potrzeby „Reset database password”).
- Schemat jest w `supabase/migrations/0001_init.sql` (zgodny z `app/models`) i jest już zastosowany w SOWA.
  Wszystkie tabele mają włączony RLS bez polityk: backend łączy się jako `postgres` (omija RLS), a klucze
  `anon`/`authenticated` (Data API) nie mają dostępu do danych, w tym `user.password_hash`.
- Przy pierwszym starcie backend załaduje dane demo, jeśli baza jest pusta (`SEED_DEMO_DATA`).
- Transaction pooler (port `6543`) też działa: `app/core/db.py` wyłącza wtedy prepared statements.
- Po zmianie modeli dopisz kolejną migrację w `supabase/migrations/` (`create_all` nie zmienia istniejących tabel).

### Postgres + pgvector (docker-compose)

```bash
docker compose up -d db
DATABASE_URL=postgresql+psycopg://kompas:kompas@localhost:5432/kompas uv run uvicorn app.main:app --reload
```

albo całość: `docker compose up --build` (backend na porcie 8000).

## Testy i lint

```bash
uv run pytest
uv run ruff check . && uv run ruff format --check .
```

## Struktura

```
app/
  main.py            # FastAPI, CORS, lifespan (create_all + seed)
  core/              # config (pydantic-settings), db, JWT/hasła
  api/               # routery: auth, competencies, employees, processes, hr, assistant
  models/            # SQLModel: User, Employee, Process, ProcessCompetency, Rating, Decision, Reminder
  schemas/           # Pydantic – kontrakt API
  domain/            # czysta logika: scoring, model kompetencji, etapy procesu
  services/          # operacje łączące DB i domenę (podsumowanie, kontekst dla AI)
  pdf/               # generator arkusza PDF (reportlab + DejaVu Sans dla polskich znaków)
  rag/               # (sesja RAG) – app.rag.service.ask
data/competency_model.json
scripts/             # import modelu, seed
```

## API (prefiks `/api`)

Autoryzacja: `Authorization: Bearer <access_token>` z `POST /api/auth/login`.

| metoda | ścieżka | opis |
| --- | --- | --- |
| GET | `/health` | status |
| POST | `/auth/login` | `{username,password}` → `{access_token, role, display_name}` |
| GET | `/auth/me` | zalogowany użytkownik |
| GET | `/competencies` | model kompetencji z opisami poziomów |
| GET | `/employees` | podwładni (HR/admin – wszyscy); tylko imię, nazwisko, stanowisko, komórka |
| GET/POST | `/processes` | lista procesów przełożonego / nowy proces `{employee_id, type, form}` |
| GET/PATCH | `/processes/{id}` | szczegóły (etap, kryteria, oceny, decyzje) / zmiana etapu, OSP, rozmowy, planu rozwoju, statusu |
| PUT | `/processes/{id}/criteria` | `{competency_ids}` – wybór kryteriów (usunięte kompetencje tracą oceny) |
| PUT/DELETE | `/processes/{id}/ratings/{indicator_id}` | `{level: 1–5 \| null, example?}`; null = brak podstaw |
| GET | `/processes/{id}/summary` | sugerowany poziom + wyjaśnienie + decyzja przełożonego |
| PUT | `/processes/{id}/decisions/{competency_id}` | `{level, justification}` – uzasadnienie wymagane, gdy ≠ sugestii |
| GET | `/processes/{id}/pdf` | arkusz oceny PDF |
| GET | `/hr/processes?status=&unit=&type=` | monitoring (status: `in_progress`, `completed`, `overdue`) |
| POST | `/hr/reminders` | `{process_ids, message?}` – zapis w tabeli + log (bez e-maila) |
| GET | `/hr/units` | lista komórek do filtra |
| POST | `/assistant/ask` | `{question, mode: formal\|interview, process_id?}` → `{answer, citations, confidence}` |

Uprawnienia: przełożony widzi i edytuje swoje procesy; HR czyta wszystkie (bez edycji ocen), admin – wszystko.

### Asystent AI

Router importuje leniwie `app.rag.service.ask(question, mode, context) -> dict`. Gdy modułu brak,
zwraca odpowiedź-zaślepkę z `confidence: "none"`. W trybie `interview` z `process_id` przekazuje
zanonimizowany kontekst procesu (stanowisko, kompetencje, poziomy, przykłady – bez imienia i nazwiska).
