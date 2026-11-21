import json
from collections import Counter

from app.rag.chunking import (MAX_TOKENS, SourceInfo, chunk_body, chunk_competency_model, chunk_form,
                              chunk_guide, chunk_legal_act, pack_sentences, parse_toc)
from app.rag.config import DEFAULT_CORPUS_DIR
from app.rag.textutil import approx_tokens, tokenize

SRC = SourceInfo("rozp_test", "Rozporządzenie testowe", "Rozp. test", "rozporzadzenie", "okresowa")


def _legal_pages():
    long_ust = " ".join(["Oceniający sporządza ocenę zgodnie z zasadami określonymi w przepisach."] * 25)
    p1 = (
        "DZIENNIK USTAW\nROZPORZĄDZENIE\nNa podstawie art. 82 ustawy zarządza się, co następuje:\n"
        "§ 1. Rozporządzenie określa warunki oceny.\n"
        "§ 2. 1. Bezpośredni przełożony dokonuje oceny.\n2. Kryteria dzielą się na obowiązkowe i dodatkowe.\n"
        f"§ 3. 1. {long_ust}\n2. {long_ust}\n3. Ostatni krótki ustęp.\n"
    )
    p2 = (
        "Dziennik Ustaw – 2 – Poz. 470\n"
        "§ 4. Rozporządzenie wchodzi w życie po upływie 14 dni od dnia ogłoszenia.\n"
        "Załącznik nr 1\nZałącznik nr 1\nWYKAZ KRYTERIÓW OCENY\nKRYTERIUM OPIS\n"
        "1. KOMUNIKACJA − Koncentrowanie się na wypowiedzi rozmówcy.\n− Wypowiadanie się w sposób jasny.\n"
        "2. ZARZĄDZANIE − Przydzielanie zakresu odpowiedzialności.\nLUDŹMI − Motywowanie pracowników.\n"
    )
    return [(1, p1), (2, p2)]


def test_legal_act_split_by_paragraph_and_ust():
    chunks = chunk_legal_act(SRC, _legal_pages())
    paths = [c["path"] for c in chunks]
    assert "§ 1" in paths and "§ 2" in paths and "§ 4" in paths
    assert any(p.startswith("§ 3 ust. 1") for p in paths)
    assert any(p.startswith("§ 3 ust. ") and p != "§ 3 ust. 1" for p in paths)
    assert all(approx_tokens(c["text"]) <= MAX_TOKENS + 50 for c in chunks)
    assert not any("Dziennik Ustaw – 2" in c["text"] for c in chunks)
    c2 = next(c for c in chunks if c["path"] == "§ 2")
    assert c2["text"].startswith("[Rozp. test | § 2]\n")
    assert c2["page"] == 1 and c2["applies_to"] == "okresowa" and c2["doc_type"] == "rozporzadzenie"


def test_legal_act_appendix_items_get_full_names():
    chunks = chunk_legal_act(SRC, _legal_pages())
    items = {c["path"]: c for c in chunks if c["path"].startswith("Załącznik nr 1 pkt")}
    assert set(items) == {"Załącznik nr 1 pkt 1 (KOMUNIKACJA)", "Załącznik nr 1 pkt 2 (ZARZĄDZANIE LUDŹMI)"}
    body = chunk_body(items["Załącznik nr 1 pkt 2 (ZARZĄDZANIE LUDŹMI)"])
    assert "Motywowanie pracowników" in body and "LUDŹMI −" not in body
    assert items["Załącznik nr 1 pkt 1 (KOMUNIKACJA)"]["page"] == 2


def test_parse_toc_handles_wrapped_entries():
    toc = ("Spis treści\n1. Istota i cel oceny ........ 3\n"
           "6.4. Zmiana stanowiska pracy zajmowanego przez nowego pracownika w trakcie procesu pierwszej\n"
           "oceny w służbie cywilnej ......... 23\n6.5.1. Rozmowa oceniająca ........ 26\n")
    assert parse_toc(toc) == [
        ("1", "Istota i cel oceny"),
        ("6.4", "Zmiana stanowiska pracy zajmowanego przez nowego pracownika w trakcie procesu pierwszej oceny w służbie cywilnej"),
        ("6.5.1", "Rozmowa oceniająca"),
    ]


def test_guide_chunks_follow_headings():
    src = SourceInfo("por", "Poradnik", "Por.", "poradnik", "pierwsza")
    toc = "Spis treści\n1. Wstęp ....... 3\n2. Rozmowa wstępna ....... 4\n2.1. Termin rozmowy ....... 4\n"
    body1 = "1. Wstęp\n" + "Poradnik opisuje procedurę oceny pracownika w urzędzie. " * 20 + "\n3"
    body2 = ("2. Rozmowa wstępna\nKrótko.\n2.1. Termin rozmowy\n"
             + "Rozmowę wstępną przeprowadza się w terminie 21 dni od nawiązania stosunku pracy. " * 15)
    chunks = chunk_guide(src, [(1, "Tytuł"), (2, toc), (3, body1), (4, body2)])
    paths = [c["path"] for c in chunks]
    assert paths[0] == "rozdz. 1. Wstęp"
    assert any(p.startswith("rozdz. 2.1. Termin rozmowy") for p in paths)
    sub = next(c for c in chunks if c["path"].startswith("rozdz. 2.1"))
    assert "(2. Rozmowa wstępna > 2.1. Termin rozmowy)" in sub["text"]
    assert sub["page"] == 4
    assert not any(c["text"].rstrip().endswith("\n3") for c in chunks)


def test_pack_sentences_respects_limits():
    sents = [f"Zdanie numer {i} opisuje szczegółowo pewną regułę dotyczącą oceniania." for i in range(200)]
    windows = pack_sentences(sents)
    assert len(windows) > 3
    assert all(approx_tokens(w) <= MAX_TOKENS + 30 for w in windows)
    assert windows[1].split(". ")[0] in windows[0]


def test_competency_model_one_chunk_per_indicator():
    src = SourceInfo("model", "Model", "Model", "model", "oba")
    levels = ["Znacznie poniżej oczekiwań", "Poniżej oczekiwań", "Na poziomie oczekiwań", "Powyżej oczekiwań",
              "Znacznie powyżej oczekiwań"]
    comps = [{"name": "RZETELNOŚĆ", "levels": levels, "indicators": [
        {"name": "Wykonywanie zadań zgodnie ze standardami", "levels": ["a", "b", "c", "d", "e"]},
        {"name": "Dotrzymywanie terminów", "levels": ["f", "g", "h", "i", "j"]}]}]
    main = [["MODEL"], ["Oprzyj ocenę na konkretnych przykładach."], ["Lp.", "Kompetencja", "Liczba"], ["1", "RZETELNOŚĆ", "2"]]
    chunks = chunk_competency_model(src, main, comps)
    assert [c["path"] for c in chunks] == ["arkusz główny – zasady i wykaz kompetencji", "RZETELNOŚĆ – lista wskaźników",
                                           "RZETELNOŚĆ – wskaźnik 1", "RZETELNOŚĆ – wskaźnik 2"]
    assert "Oprzyj ocenę" in chunks[0]["text"]
    ind2 = chunks[3]["text"]
    assert "Dotrzymywanie terminów" in ind2 and "- Powyżej oczekiwań: i" in ind2


def test_form_sections_and_footnotes():
    src = SourceInfo("ark", "Arkusz", "Arkusz", "formularz", "okresowa")
    blocks = ["ARKUSZ B", "CZĘŚĆ I", "DANE OCENIANEGO", "Imię", "Stanowisko pracy (przypis 2)", "CZĘŚĆ II", "Ocena | 1 punkt"]
    chunks = chunk_form(src, blocks, {"2": "Należy wskazać pełną nazwę stanowiska."})
    assert any("Część i" in c["path"] for c in chunks)
    notes = [c for c in chunks if c["path"].startswith("objaśnienia")]
    assert notes and "Przypis 2: Należy wskazać" in notes[0]["text"]


def test_tokenize_folds_diacritics_and_legal_refs():
    toks = tokenize("Zgodnie z § 5 ust. 2 rozporządzenia oceniający wybiera kryteria")
    assert "par5" in toks and "ust2" in toks
    assert "rozpor" in toks
    assert tokenize("rozporzadzenia")[:1] == tokenize("rozporządzenia")[:1]


def test_built_corpus_metadata():
    path = DEFAULT_CORPUS_DIR / "chunks.jsonl"
    chunks = [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]
    assert len(chunks) > 150
    ids = [c["id"] for c in chunks]
    assert len(ids) == len(set(ids))
    for c in chunks:
        assert set(c) >= {"id", "source", "doc_type", "path", "page", "applies_to", "text"}
        assert c["doc_type"] in {"rozporzadzenie", "poradnik", "model", "formularz", "qa"}
        assert c["applies_to"] in {"pierwsza", "okresowa", "oba"}
        assert c["text"].startswith("[") and approx_tokens(c["text"]) <= MAX_TOKENS + 60
    by_src = Counter(c["source_id"] for c in chunks)
    assert by_src["model_kompetencji"] == 1 + 14 + 49
    assert sum(1 for c in chunks if c["source_id"] == "rozp_okresowa_2016" and c["path"] == "§ 5") == 1
