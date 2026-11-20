"""SQLite storage. One connection per request; schema upgrades run on startup."""

import sqlite3
from pathlib import Path

# Append-only: each entry upgrades the schema by one `user_version`.
MIGRATIONS = [
    """
    CREATE TABLE projects (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
    );
    CREATE TABLE tasks (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        due_date TEXT,
        -- assignee: NULL kind = unassigned, 'user' = the human, 'agent' = agent + model
        assignee_kind TEXT,
        assignee_agent TEXT,
        assignee_model TEXT,
        position REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE INDEX tasks_project ON tasks(project_id);
    CREATE TABLE task_tags (
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        tag TEXT NOT NULL COLLATE NOCASE,
        PRIMARY KEY (task_id, tag)
    );
    CREATE TABLE comments (
        id INTEGER PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        actor_kind TEXT NOT NULL,
        actor_agent TEXT,
        actor_model TEXT,
        created_at TEXT NOT NULL
    );
    -- No foreign keys: the activity feed keeps a deleted task's events.
    CREATE TABLE events (
        id INTEGER PRIMARY KEY,
        task_id INTEGER,
        project_id INTEGER,
        task_title TEXT,
        kind TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        actor_kind TEXT NOT NULL,
        actor_agent TEXT,
        actor_model TEXT,
        created_at TEXT NOT NULL
    );
    CREATE INDEX events_task ON events(task_id);
    """,
]


def connect(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def adopt_legacy(path: str) -> None:
    """Rename ffloom.db (from before the rename to rail) to `path` if `path` doesn't exist yet."""
    new = Path(path)
    old = new.with_name("ffloom.db")
    if path == ":memory:" or new.exists() or new == old or not old.exists():
        return
    for suffix in ("", "-wal", "-shm"):  # WAL files must move with the database
        src = Path(f"{old}{suffix}")
        if src.exists():
            src.rename(f"{new}{suffix}")


def migrate(path: str) -> None:
    if path != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    adopt_legacy(path)
    conn = connect(path)
    try:
        conn.execute("PRAGMA journal_mode = WAL")
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        for i, sql in enumerate(MIGRATIONS[version:], start=version + 1):
            conn.executescript(f"BEGIN; {sql}; PRAGMA user_version = {i}; COMMIT;")
    finally:
        conn.close()
