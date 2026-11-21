"""Normalizacja tekstu i tokenizacja dla BM25 (język polski, bez zewnętrznych zależności)."""

from __future__ import annotations

import re
import unicodedata

# Bardzo pospolite słowa, które nie niosą treści dla wyszukiwania.
_STOPWORDS = {
    "a", "aby", "albo", "ale", "bez", "by", "być", "czy", "dla", "do", "gdy", "i", "ich", "ile",
    "jak", "jaka", "jaki", "jakie", "jakim", "jaką", "jest", "jeśli", "jeżeli", "już", "ja", "go",
    "jej", "jego", "kto", "która", "które", "który", "którzy", "lub", "ma", "mam", "mi", "mnie",
    "może", "na", "nad", "nie", "niż", "o", "od", "oraz", "po", "pod", "przez", "przy", "się",
    "są", "ta", "tak", "te", "tego", "ten", "to", "tym", "tylko", "u", "w", "we", "według", "z",
    "za", "ze", "że", "co", "czym", "czego", "jako", "także", "też", "być", "będzie", "można",
    "należy", "powinien", "powinna", "trzeba", "proszę", "mój", "moja", "moje", "mojego",
    "swojego", "swoje", "kiedy", "gdzie", "dlaczego", "jakich", "jakiej", "jakiego",
    "temat", "tego", "tej", "tych", "tę", "kogo", "komu", "kim", "zrobić", "robić", "było", "był",
    "była", "były", "jest", "są", "danego", "danej", "który", "którym", "której", "których", "czy",
    "mogę", "może", "mogą", "musi", "muszę", "wtedy", "jeśli", "jeżeli", "itp", "np", "jakim",
    "jakimi", "sposób", "chodzi", "chcę", "chciałbym", "chciałabym", "powiedz", "wyjaśnij", "opisz",
}

_PL_FOLD = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")
_STEM_LEN = 6
_SHORT_STEM = 4

_LEGAL_REF = re.compile(r"(§|art\.?|ust\.?|pkt|lit\.?)\s*(\d+[a-z]?)", re.IGNORECASE)
_TOKEN = re.compile(r"[0-9a-ząćęłńóśźż§]+", re.IGNORECASE)


def fold(text: str) -> str:
    """Małe litery, bez polskich znaków diakrytycznych (użytkownik może pisać bez ogonków)."""
    text = unicodedata.normalize("NFC", text).lower()
    return text.translate(_PL_FOLD)


def _legal_tokens(text: str) -> list[str]:
    out = []
    for kind, num in _LEGAL_REF.findall(text):
        k = kind.lower().rstrip(".")
        k = {"§": "par"}.get(k, k)
        out.append(f"{k}{num.lower()}")
    return out


def tokenize(text: str) -> list[str]:
    """Tokeny do BM25: odcięcie końcówek (prefiks 6 znaków) jako prosty stemming dla polszczyzny,
    plus tokeny odwołań prawnych (np. ``par5``, ``ust2``, ``art81``)."""
    tokens = []
    for raw in _TOKEN.findall(text.lower()):
        if raw in _STOPWORDS or raw == "§":
            continue
        t = fold(raw)
        if t.isdigit():
            continue  # same liczby obsługują tokeny odwołań prawnych
        if len(t) < 2:
            continue
        tokens.append(t[:_STEM_LEN])
        if _SHORT_STEM and len(t) > _SHORT_STEM + 1:
            # krótszy rdzeń łapie odmianę czasowników/rzeczowników odsłownych (kieruje ~ kierowanie)
            tokens.append("~" + t[:_SHORT_STEM])
    tokens.extend(_legal_tokens(text))
    return tokens


def approx_tokens(text: str) -> int:
    """Przybliżona liczba tokenów LLM dla tekstu polskiego (~4 znaki na token)."""
    return max(1, len(text) // 4)


def clean_ws(text: str) -> str:
    text = text.replace("\u00a0", " ").replace("\uf0b7", "•").replace("\uf0a7", "•").replace("\uf02d", "-")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def dehyphenate(text: str) -> str:
    """Scala wyrazy przeniesione do następnej linii ("zajmowa-\\nnego" -> "zajmowanego")."""
    return re.sub(r"(\w)-\n(\w)", r"\1\2", text)


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.;:!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ0-9•\-−§(])", text)
    return [p.strip() for p in parts if p.strip()]
