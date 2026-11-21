import json
from pathlib import Path

from tests.conftest import login


def test_competency_model_counts():
    data = json.loads(
        (Path(__file__).parents[1] / "data" / "competency_model.json").read_text(encoding="utf-8")
    )
    comps = data["competencies"]
    assert len(comps) == 14
    assert sum(len(c["indicators"]) for c in comps) == 49
    for c in comps:
        for ind in c["indicators"]:
            assert [lvl["level"] for lvl in ind["levels"]] == [1, 2, 3, 4, 5]
            assert all(lvl["description"] for lvl in ind["levels"])


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_login(client):
    r = client.post("/api/auth/login", json={"username": "hr", "password": "demo123"})
    body = r.json()
    assert r.status_code == 200
    assert body["role"] == "hr" and body["display_name"] and body["access_token"]
    assert client.post("/api/auth/login", json={"username": "hr", "password": "zle"}).status_code == 401


def test_requires_auth(client):
    assert client.get("/api/processes").status_code == 401


def test_competencies_endpoint(client):
    comps = client.get("/api/competencies").json()
    assert len(comps) == 14
    assert set(comps[0]) == {"id", "name", "indicators"}
    assert set(comps[0]["indicators"][0]["levels"][0]) == {"level", "label", "description"}


def test_manager_sees_only_own(client, manager):
    procs = client.get("/api/processes", headers=manager).json()
    assert len(procs) == 3
    emps = client.get("/api/employees", headers=manager).json()
    assert len(emps) == 5
    assert set(emps[0]) == {"id", "first_name", "last_name", "position", "unit"}
    other = login(client, "przelozony2")
    foreign = client.get("/api/processes", headers=other).json()[0]["id"]
    assert client.get(f"/api/processes/{foreign}", headers=manager).status_code == 403


def test_full_flow(client, manager):
    emp = client.get("/api/employees", headers=manager).json()[1]
    r = client.post(
        "/api/processes", headers=manager, json={"employee_id": emp["id"], "type": "periodic", "form": "B"}
    )
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert r.json()["stage"] == "job_description"

    r = client.patch(
        f"/api/processes/{pid}", headers=manager, json={"stage": "criteria", "job_description": "OSP"}
    )
    assert r.json()["stage"] == "criteria"

    r = client.put(f"/api/processes/{pid}/criteria", headers=manager, json={"competency_ids": ["K01", "K02"]})
    assert r.json()["criteria"] == ["K01", "K02"]

    # wskaźnik spoza kryteriów
    assert (
        client.put(f"/api/processes/{pid}/ratings/K05-W1", headers=manager, json={"level": 3}).status_code
        == 409
    )

    for ind, level in [("K02-W1", 2), ("K02-W2", 4), ("K02-W3", None), ("K02-W4", 5)]:
        r = client.put(
            f"/api/processes/{pid}/ratings/{ind}", headers=manager, json={"level": level, "example": "x"}
        )
        assert r.status_code == 200, r.text
    assert (
        client.put(f"/api/processes/{pid}/ratings/K02-W1", headers=manager, json={"level": 7}).status_code
        == 422
    )

    summary = {
        s["competency_id"]: s for s in client.get(f"/api/processes/{pid}/summary", headers=manager).json()
    }
    k02 = summary["K02"]
    assert (k02["rated"], k02["total"], k02["no_basis"], k02["suggested_level"]) == (3, 4, 1, 4)
    assert summary["K01"]["suggested_level"] is None

    # zgodnie z sugestią – uzasadnienie niewymagane
    assert (
        client.put(f"/api/processes/{pid}/decisions/K02", headers=manager, json={"level": 4}).status_code
        == 200
    )
    # odejście od sugestii bez uzasadnienia
    r = client.put(
        f"/api/processes/{pid}/decisions/K02", headers=manager, json={"level": 3, "justification": " "}
    )
    assert r.status_code == 422
    r = client.put(
        f"/api/processes/{pid}/decisions/K02", headers=manager, json={"level": 3, "justification": "Bo."}
    )
    assert r.status_code == 200 and r.json()["suggested_level"] == 4

    s = {x["competency_id"]: x for x in client.get(f"/api/processes/{pid}/summary", headers=manager).json()}
    assert s["K02"]["manager_level"] == 3 and s["K02"]["justification"] == "Bo."

    r = client.get(f"/api/processes/{pid}/pdf", headers=manager)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")

    # usunięcie kompetencji z kryteriów kasuje jej oceny
    client.put(f"/api/processes/{pid}/criteria", headers=manager, json={"competency_ids": ["K01"]})
    detail = client.get(f"/api/processes/{pid}", headers=manager).json()
    assert detail["ratings"] == [] and detail["decisions"] == []


def test_type_form_validation(client, manager):
    emp = client.get("/api/employees", headers=manager).json()[0]["id"]
    bad = [
        {"type": "first", "form": "B"},
        {"type": "periodic", "form": None},
        {"type": "periodic", "form": "X"},
    ]
    for body in bad:
        assert (
            client.post("/api/processes", headers=manager, json={"employee_id": emp, **body}).status_code
            == 422
        )
    ok = client.post(
        "/api/processes", headers=manager, json={"employee_id": emp, "type": "first", "form": None}
    )
    assert ok.status_code == 201


def test_hr_endpoints(client, hr, manager):
    assert client.get("/api/hr/processes", headers=manager).status_code == 403
    allp = client.get("/api/hr/processes", headers=hr).json()
    assert len(allp) == 4
    assert len(client.get("/api/hr/processes?type=first", headers=hr).json()) == 1
    assert len(client.get("/api/hr/processes?status=completed", headers=hr).json()) == 1
    assert len(client.get("/api/hr/processes?status=overdue", headers=hr).json()) == 1
    assert len(client.get("/api/hr/processes?unit=Biuro Administracyjne", headers=hr).json()) == 1
    r = client.post("/api/hr/reminders", headers=hr, json={"process_ids": [allp[0]["id"]]})
    assert r.status_code == 201 and r.json()["created"] == 1
    again = {p["id"]: p for p in client.get("/api/hr/processes", headers=hr).json()}
    assert again[allp[0]["id"]]["last_reminder_at"] is not None
    # HR nie edytuje ocen
    assert (
        client.put(
            f"/api/processes/{allp[0]['id']}/criteria", headers=hr, json={"competency_ids": []}
        ).status_code
        == 403
    )


def test_assistant_fallback_without_rag(client, manager):
    r = client.post(
        "/api/assistant/ask", headers=manager, json={"question": "Jaki jest termin?", "mode": "formal"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["confidence"] in {"none", "high", "partial"}
    assert set(body) == {"answer", "citations", "confidence"}


def test_assistant_interview_context_is_anonymized(client, manager, monkeypatch):
    import app.api.assistant as assistant

    captured = {}

    async def fake_ask(question, mode, context):
        captured.update(question=question, mode=mode, context=context)
        return {
            "answer": "ok [1]",
            "citations": [{"marker": "[1]", "source": "Poradnik"}],
            "confidence": "high",
        }

    monkeypatch.setattr(assistant, "_load_ask", lambda: fake_ask)
    procs = client.get("/api/processes", headers=manager).json()
    p = next(p for p in procs if p["stage"] == "summary")
    r = client.post(
        "/api/assistant/ask",
        headers=manager,
        json={"question": "Pytania?", "mode": "interview", "process_id": p["id"]},
    )
    assert r.status_code == 200 and r.json()["confidence"] == "high"
    ctx = json.dumps(captured["context"], ensure_ascii=False)
    assert p["employee"]["last_name"] not in ctx and p["employee"]["first_name"] not in ctx
    assert captured["context"]["competencies"]
