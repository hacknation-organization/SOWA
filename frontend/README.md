# Kompas kompetencji – frontend

Desktopowa aplikacja webowa (Next.js App Router + React + TypeScript + Tailwind v4 + komponenty w stylu shadcn/ui) wspierająca przełożonych w służbie cywilnej w pierwszej ocenie i ocenie okresowej (arkusze B/C).

## Uruchomienie

```bash
npm install
npm run dev
```

Aplikacja startuje pod http://localhost:3000. Inne skrypty:

| Skrypt | Opis |
| --- | --- |
| `npm run build` | build produkcyjny |
| `npm run lint` | ESLint |
| `npm run build:mock-model` | regeneruje `src/lib/api/mock/competency-model.json` z `docs/HackNation/Model_kompetencji.xlsx` (szuka w katalogach nadrzędnych; ścieżkę można podać jako argument) |

## Tryb mock vs API

- **Mock (domyślnie)** – gdy `NEXT_PUBLIC_API_URL` nie jest ustawione. Całe API działa w przeglądarce (`src/lib/api/mock/`), a stan zapisuje się w `localStorage` (klucz `kk.mock.v1`; usuń go, aby wrócić do danych początkowych). Logowanie: wybór roli demo albo login `przelozony` / `hr` / `admin` z dowolnym hasłem.
- **API** – utwórz `.env.local`:

  ```
  NEXT_PUBLIC_API_URL=http://localhost:8000
  ```

  Klient (`src/lib/api/client.ts`) wywołuje endpointy z prefiksem `/api` i wysyła `Authorization: Bearer <access_token>`.

### Kontrakt i rozszerzenia

Typy w `src/lib/api/types.ts` odpowiadają kontraktowi (`/auth/login`, `/competencies`, `/employees`, `/processes…`, `/hr/…`, `/assistant/ask`). Frontend używa dodatkowo:

- `PATCH /api/processes/{id}` z polami `job_description`, `form`, `stage`, `interview_notes`, `development_plan` – zapis opisu stanowiska, wybór arkusza, przejście do kolejnego etapu, notatki z rozmowy i plan rozwoju.
- W obiekcie procesu opcjonalnie: `employee_name`, `unit`, `status`, `deadline`, `competency_ids`, `ratings`, `reminder_sent_at`.
- Identyfikatory kompetencji/wskaźników jak w imporcie backendu: `K01`, `K01-W1`.

## Co działa

- Logowanie z wyborem roli demo; nawigacja i dostęp zależne od roli (HR/admin → monitoring).
- Pulpit przełożonego: oceny w toku i zakończone, start pierwszej lub okresowej oceny.
- Kreator oceny (`/assessments/[id]`), 6 kroków:
  1. Opis stanowiska – wybór przykładowego OSP lub wklejenie treści, wybór arkusza B/C (z sugestią na podstawie OSP).
  2. Kryteria – kryteria obowiązkowe arkusza zablokowane, maks. 3 dodatkowe, sugestie z OSP.
  3. Ocena zachowań – jeden wskaźnik naraz, 5 opisów zachowań z modelu, „brak podstaw do oceny”, przykład; skróty `1`–`5`, `0`, `N`/`P`.
  4. Podsumowanie – sugerowany poziom (mediana ocenionych wskaźników, remis → niższy) z wyjaśnieniem, decyzja przełożonego, wymagane uzasadnienie przy różnicy.
  5. Rozmowa – asystent w trybie `interview` (pytania, tematy, plan rozwoju), notatki i plan rozwoju.
  6. Dokument – tabela ocen i pobranie PDF.
- Panel asystenta (tryb `formal`) z boku kreatora; cytaty jako odnośniki do rozwijanego fragmentu źródła; wyraźny komunikat przy `confidence: "none"`.
- `/hr` – tabela procesów, filtry (status, komórka, rodzaj), terminy, zaznaczanie i wysyłka przypomnień.
- `/assistant` – pełnoekranowy czat.
- Poniżej 1024 px szerokości – komunikat, że aplikacja jest przeznaczona na komputer.

## Zaślepki (tryb mock)

- Asystent: dopasowanie słów kluczowych do kilku fragmentów (arkusze B/C, model kompetencji) – prawdziwy RAG dostarcza backend.
- PDF: uproszczony dokument bez polskich znaków; docelowy arkusz zgodny ze wzorem generuje backend (`GET /processes/{id}/pdf`).
- Przypomnienia HR: zapis daty wysyłki, bez faktycznej wysyłki.
- Logowanie: bez weryfikacji hasła.

## Struktura

```
scripts/build-mock-model.mjs   generator mocków modelu kompetencji (xlsx → JSON)
src/
  app/
    fonts.ts                   jedyne miejsce ładowania krojów (next/font)
    globals.css                mapowanie tokenów na zmienne shadcn/Tailwind
    login/                     wybór roli demo / formularz logowania
    (app)/                     widoki po zalogowaniu (wspólny AppShell)
      page.tsx                 pulpit przełożonego
      assessments/new/         start oceny
      assessments/[id]/        kreator oceny
      hr/                      monitoring HR
      assistant/               czat z asystentem
  components/
    ui/                        komponenty bazowe w stylu shadcn/ui
    wizard/                    kroki kreatora
    assistant-chat.tsx         czat z cytatami (używany w kreatorze i /assistant)
    app-shell.tsx              układ, nawigacja, kontrola ról
  lib/
    api/                       typy, klient HTTP, mocki
    domain.ts                  reguły: kryteria obowiązkowe B/C, punkty, mediana
    routes.ts                  ścieżki aplikacji (jedno miejsce)
    job-description-samples.ts przykładowe OSP (skrót z materiałów organizatora)
  styles/tokens.css            wszystkie tokeny wizualne (kolory, promienie, odstępy, kroje)
```

## Zmiana wyglądu

Kierunek wizualny podmienia się w dwóch plikach: `src/styles/tokens.css` (kolory, promienie, odstępy, szerokości paneli) i `src/app/fonts.ts` (kroje). Komponenty używają wyłącznie klas opartych na tokenach.
