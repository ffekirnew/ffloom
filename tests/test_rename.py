"""Setups from before ffloom was renamed to rail keep working."""

from fastapi.testclient import TestClient

from rail import db, env, server


def test_old_agent_headers_still_name_the_agent(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "DB_PATH", str(tmp_path / "rail.db"))
    with TestClient(server.app) as client:
        project = client.post("/api/projects", json={"name": "life"}).json()
        t = client.post(
            "/api/tasks", headers={"X-Ffloom-Agent": "Claude Code", "X-Ffloom-Model": "Opus 5.5"},
            json={"project_id": project["id"], "title": "Renew passport"},
        ).json()
        actor = client.get(f"/api/tasks/{t['id']}").json()["history"][0]["actor"]
    assert actor == {"kind": "agent", "agent": "Claude Code", "model": "Opus 5.5"}


def test_env_prefers_rail_and_falls_back_to_ffloom(monkeypatch):
    monkeypatch.delenv("RAIL_AGENT", raising=False)
    monkeypatch.setenv("FFLOOM_AGENT", "Codex")
    assert env("AGENT") == "Codex"
    monkeypatch.setenv("RAIL_AGENT", "Claude Code")
    assert env("AGENT") == "Claude Code"
    monkeypatch.delenv("RAIL_URL", raising=False)
    monkeypatch.delenv("FFLOOM_URL", raising=False)
    assert env("URL", "http://127.0.0.1:8020") == "http://127.0.0.1:8020"


def project_names(path):
    conn = db.connect(str(path))
    try:
        return [r["name"] for r in conn.execute("SELECT name FROM projects")]
    finally:
        conn.close()


def add_project(path, name):
    conn = db.connect(str(path))
    conn.execute("INSERT INTO projects (name, created_at) VALUES (?, '2026-11-20T00:00:00Z')", (name,))
    conn.commit()
    conn.close()


def test_existing_ffloom_db_is_adopted(tmp_path):
    old, new = tmp_path / "ffloom.db", tmp_path / "rail.db"
    db.migrate(str(old))
    add_project(old, "self-host")
    db.migrate(str(new))
    assert not old.exists()
    assert project_names(new) == ["self-host"]


def test_existing_rail_db_is_never_replaced(tmp_path):
    old, new = tmp_path / "ffloom.db", tmp_path / "rail.db"
    db.migrate(str(old))
    add_project(old, "old")
    db.migrate(str(new))  # adopts ffloom.db
    db.migrate(str(old))  # a fresh ffloom.db appears later
    add_project(old, "stray")
    db.migrate(str(new))
    assert project_names(new) == ["old"] and old.exists()
