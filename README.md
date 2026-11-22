# SOWA - System Oceny, Wsparcia i Analizy

Desktopowa aplikacja webowa, która prowadzi przełożonego w służbie cywilnej krok po kroku przez **pierwszą ocenę** i **ocenę okresową** (arkusze B/C) na podstawie modelu kompetencji (14 kompetencji, 49 wskaźników behawioralnych, 5 poziomów).

> HackNation 2026 · zadanie Ministerstwa Cyfryzacji (MC BDG)

## Co robi

- **Kreator oceny w 6 krokach:** opis stanowiska → kryteria → ocena zachowań → podsumowanie → rozmowa → dokument PDF.
- **Sugerowany poziom liczy kod, nie AI** – mediana ocenionych wskaźników (remis → niższy). Decyzję zawsze podejmuje przełożony; odejście od sugestii wymaga uzasadnienia.
- **Asystent AI (RAG)** odpowiada wyłącznie na bazie dostarczonych materiałów, cytuje źródła i mówi wprost, gdy nie ma podstaw. Pomaga w kwestiach formalnych i w przygotowaniu rozmowy (bez danych osobowych pracownika).
- **Panel HR:** monitoring procesów, filtry, terminy, przypomnienia.
- **Arkusz oceny w PDF.**

## Stack

| Warstwa | Technologie |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind v4, shadcn/ui |
| Backend | FastAPI, SQLModel, JWT, ReportLab |
| Dane | Postgres (Supabase / pgvector) lub SQLite lokalnie |
| AI | RAG: BM25 + LLM (Gemini, Groq, Claude, OpenAI, OpenRouter lub Ollama) |

## Szybki start

**Frontend** (działa od razu w trybie mock, bez backendu):

```bash
cd frontend
npm install
npm run dev
```

Aplikacja: http://localhost:3000 – wybierz rolę demo na ekranie logowania.

**Backend** (Python 3.12 + [uv](https://docs.astral.sh/uv/)):

```bash
cd backend
cp .env.example .env     # ustaw DATABASE_URL (np. sqlite:///./kompas.db) i klucz LLM
uv sync
uv run uvicorn app.main:app --reload
```

API: http://localhost:8000/docs · przy pierwszym starcie ładują się dane demo.
Aby połączyć frontend z backendem, utwórz `frontend/.env.local` z `NEXT_PUBLIC_API_URL=http://localhost:8000`.

Całość w Dockerze: `docker compose up --build`.

## Konta demo

Hasło `demo123` (w trybie mock frontendu – dowolne): `przelozony`, `przelozony2`, `hr`, `admin`.

## Struktura

```
frontend/   Next.js – UI, kreator oceny, panel HR, czat z asystentem
backend/    FastAPI – API, scoring, PDF, moduł RAG (app/rag)
docs/       treść zadania, regulamin, materiały organizatora
```

Szczegóły: [frontend/README.md](frontend/README.md) · [backend/README.md](backend/README.md) · [backend/app/rag/README.md](backend/app/rag/README.md)

## Testy

```bash
cd backend && uv run pytest
```
