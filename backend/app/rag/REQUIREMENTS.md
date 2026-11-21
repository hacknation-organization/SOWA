# Zależności modułu `app.rag`

Do dopisania w `backend/pyproject.toml` przy integracji. Wszystkie pakiety są z uzgodnionej listy, więc moduł nie wymaga żadnych dodatkowych zależności.

| pakiet | do czego | kiedy potrzebny |
|---|---|---|
| `rank-bm25` | wyszukiwanie BM25 | w trakcie działania |
| `numpy` | embeddingi (macierz, cosinus) | w trakcie działania |
| `httpx` | wywołania REST Gemini / Groq | w trakcie działania |
| `pdfplumber` | ekstrakcja tekstu z PDF | tylko `scripts/ingest.py` |
| `openpyxl` | `Model_kompetencji.xlsx` | tylko `scripts/ingest.py` |
| `python-docx` | arkusze `.docx` | tylko `scripts/ingest.py` |
| `pytest` | `tests/rag` | dev |

Nie używam: `google-genai` (Gemini jest wołane przez REST/httpx, więc jest o jedną zależność mniej i łatwiej je mockować), `pypdf`, `pgvector` / `sqlmodel` (indeks jest w plikach; pgvector to opcjonalny krok produkcyjny, opisany w README).

Wymagany Python: 3.10 lub nowszy (składnia `X | None`). Testowane na Pythonie 3.12.
