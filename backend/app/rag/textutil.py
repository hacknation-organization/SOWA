from __future__ import annotations

import re
import unicodedata

_STOPWORDS = {
    "a", "aby", "albo", "ale", "bez", "by", "być", "czy", "dla", "do", "gdy", "i", "ich", "ile",
    "jak", "jaka", "jaki", "jakie", "jakim", "jaką", "jest", "jeśli", "jeżeli", "już", "ja", "go",
    "jej", "jego", "kto", "która", "które", "który", "którzy", "lub", "ma", "mam", "mi", "mnie",
    "może", "na", "nad", "nie", "niż", "o", "od", "oraz", "po", "pod", "przez", "przy", "się",
    "są", "ta", "tak", "te", "tego", "ten", "to", "tym", "tylko", "u", "w", "we", "według", "z",
    "za", "ze", "że", "co", "czym", "czego", "jako", "także", "też", "będzie", "można",
    "należy", "powinien", "powinna", "trzeba", "proszę", "mój", "moja", "moje", "mojego",
    "swojego", "swoje", "kiedy", "gdzie", "dlaczego", "jakich", "jakiej", "jakiego",
    "temat", "tej", "tych", "tę", "kogo", "komu", "kim", "zrobić", "robić", "było", "był",
    "była", "były", "danego", "danej", "którym", "której", "których",
    "mogę", "mogą", "musi", "muszę", "wtedy", "itp", "np",
    "jakimi", "sposób", "chodzi", "chcę", "chciałbym", "chciałabym", "powiedz", "wyjaśnij", "opisz",
}

_PL_FOLD = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")
_STEM_LEN = 6
_SHORT_STEM = 4

_LEGAL_REF = re.compile(r"(§|art\.?|ust\.?|pkt|lit\.?)\s*(\d+[a-z]?)", re.IGNORECASE)
_TOKEN = re.compile(r"[0-9a-ząćęłńóśźż§]+", re.IGNORECASE)


def fold(text: str) -> str:
    text = unicodedata.normalize("NFC", text).lower()
    return text.translate(_PL_FOLD)


def _legal_tokens(text: str) -> list[str]:
    out = []
    for kind, num in _LEGAL_REF.findall(text):
        prefix = kind.lower().rstrip(".")
        prefix = "par" if prefix == "§" else prefix
        out.append(f"{prefix}{num.lower()}")
    return out


def tokenize(text: str) -> list[str]:
    tokens = []
    for raw in _TOKEN.findall(text.lower()):
        if raw in _STOPWORDS or raw == "§":
            continue
        token = fold(raw)
        if token.isdigit() or len(token) < 2:
            continue
        tokens.append(token[:_STEM_LEN])
        if len(token) > _SHORT_STEM + 1:
            tokens.append("~" + token[:_SHORT_STEM])
    tokens.extend(_legal_tokens(text))
    return tokens


def approx_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def clean_ws(text: str) -> str:
    text = text.replace("\u00a0", " ").replace("\uf0b7", "•").replace("\uf0a7", "•").replace("\uf02d", "-")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def dehyphenate(text: str) -> str:
    return re.sub(r"(\w)-\n(\w)", r"\1\2", text)


def split_sentences(text: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"(?<=[.;:!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ0-9•\-−§(])", text) if p.strip()]
    out: list[str] = []
    carry = ""
    for p in parts:
        if re.fullmatch(r"(§\s*)?\d+[a-z]?[.)]", p):
            carry += p + " "
            continue
        out.append(carry + p)
        carry = ""
    if carry:
        out.append(carry.strip())
    return out
