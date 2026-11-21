"""Tworzy tabele i ładuje dane demo.  Użycie: uv run python scripts/seed.py [--reset]"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlmodel import Session, SQLModel  # noqa: E402

from app.core.db import get_engine, init_db  # noqa: E402
from app.seed import DEMO_PASSWORD, seed_demo  # noqa: E402

if __name__ == "__main__":
    if "--reset" in sys.argv:
        import app.models  # noqa: F401

        SQLModel.metadata.drop_all(get_engine())
    init_db()
    with Session(get_engine()) as session:
        done = seed_demo(session)
    print("Załadowano dane demo" if done else "Baza zawiera już dane – użyj --reset, aby je odtworzyć")
    print(f"Użytkownicy: przelozony, przelozony2, hr, admin (hasło: {DEMO_PASSWORD})")
