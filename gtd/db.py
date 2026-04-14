"""SQLite persistence layer for the GTD app.

Single-file database. Safe to call `get_conn()` repeatedly; the connection is
cached per-thread by Streamlit. Schema is created on first use.
"""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, date
from typing import Iterable, Optional

DB_PATH = os.environ.get("GTD_DB_PATH", "gtd.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS contexts (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    outcome      TEXT,
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TEXT NOT NULL,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS inbox_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_text   TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS actions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    notes         TEXT,
    status        TEXT NOT NULL DEFAULT 'next',
    context_id    INTEGER REFERENCES contexts(id) ON DELETE SET NULL,
    project_id    INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    delegated_to  TEXT,
    due_date      TEXT,
    created_at    TEXT NOT NULL,
    completed_at  TEXT
);

CREATE TABLE IF NOT EXISTS reference_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    body       TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    kind         TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    notes        TEXT
);
"""

DEFAULT_CONTEXTS = ["@computer", "@phone", "@home", "@errands", "@office", "@anywhere"]


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def get_conn() -> sqlite3.Connection:
    """Return a process-wide SQLite connection, initializing schema on first call."""
    global _CONN
    try:
        return _CONN  # type: ignore[name-defined]
    except NameError:
        pass
    conn = _connect()
    conn.executescript(SCHEMA)
    # Seed default contexts once.
    existing = conn.execute("SELECT COUNT(*) FROM contexts").fetchone()[0]
    if existing == 0:
        conn.executemany(
            "INSERT INTO contexts (name) VALUES (?)",
            [(c,) for c in DEFAULT_CONTEXTS],
        )
        conn.commit()
    globals()["_CONN"] = conn
    return conn


def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds")


@contextmanager
def tx():
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


# --- Inbox ------------------------------------------------------------------

def add_inbox_item(raw_text: str) -> int:
    raw_text = raw_text.strip()
    if not raw_text:
        raise ValueError("Empty capture")
    with tx() as conn:
        cur = conn.execute(
            "INSERT INTO inbox_items (raw_text, created_at) VALUES (?, ?)",
            (raw_text, now_iso()),
        )
        return cur.lastrowid


def list_inbox() -> list[sqlite3.Row]:
    return get_conn().execute(
        "SELECT * FROM inbox_items ORDER BY created_at ASC"
    ).fetchall()


def delete_inbox_item(item_id: int) -> None:
    with tx() as conn:
        conn.execute("DELETE FROM inbox_items WHERE id = ?", (item_id,))


def inbox_count() -> int:
    return get_conn().execute("SELECT COUNT(*) FROM inbox_items").fetchone()[0]


# --- Contexts ---------------------------------------------------------------

def list_contexts() -> list[sqlite3.Row]:
    return get_conn().execute("SELECT * FROM contexts ORDER BY name").fetchall()


def add_context(name: str) -> int:
    name = name.strip()
    if not name:
        raise ValueError("Empty context name")
    if not name.startswith("@"):
        name = "@" + name
    with tx() as conn:
        cur = conn.execute(
            "INSERT OR IGNORE INTO contexts (name) VALUES (?)", (name,)
        )
        if cur.lastrowid:
            return cur.lastrowid
    row = get_conn().execute(
        "SELECT id FROM contexts WHERE name = ?", (name,)
    ).fetchone()
    return row["id"]


# --- Projects ---------------------------------------------------------------

def list_projects(status: Optional[str] = "active") -> list[sqlite3.Row]:
    conn = get_conn()
    if status is None:
        return conn.execute(
            "SELECT * FROM projects ORDER BY created_at DESC"
        ).fetchall()
    return conn.execute(
        "SELECT * FROM projects WHERE status = ? ORDER BY created_at DESC",
        (status,),
    ).fetchall()


def add_project(title: str, outcome: str = "", status: str = "active") -> int:
    title = title.strip()
    if not title:
        raise ValueError("Project title required")
    with tx() as conn:
        cur = conn.execute(
            "INSERT INTO projects (title, outcome, status, created_at) VALUES (?, ?, ?, ?)",
            (title, outcome.strip(), status, now_iso()),
        )
        return cur.lastrowid


def set_project_status(project_id: int, status: str) -> None:
    completed_at = now_iso() if status == "complete" else None
    with tx() as conn:
        conn.execute(
            "UPDATE projects SET status = ?, completed_at = ? WHERE id = ?",
            (status, completed_at, project_id),
        )


def projects_missing_next_action() -> list[sqlite3.Row]:
    """Active projects with no action in status='next' — a weekly-review signal."""
    return get_conn().execute(
        """
        SELECT p.*
          FROM projects p
         WHERE p.status = 'active'
           AND NOT EXISTS (
               SELECT 1 FROM actions a
                WHERE a.project_id = p.id AND a.status = 'next'
           )
         ORDER BY p.created_at DESC
        """
    ).fetchall()


# --- Actions ----------------------------------------------------------------

def add_action(
    title: str,
    notes: str = "",
    status: str = "next",
    context_id: Optional[int] = None,
    project_id: Optional[int] = None,
    delegated_to: Optional[str] = None,
    due_date: Optional[str] = None,
) -> int:
    title = title.strip()
    if not title:
        raise ValueError("Action title required")
    with tx() as conn:
        cur = conn.execute(
            """
            INSERT INTO actions
                (title, notes, status, context_id, project_id,
                 delegated_to, due_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                title,
                notes.strip(),
                status,
                context_id,
                project_id,
                delegated_to,
                due_date,
                now_iso(),
            ),
        )
        return cur.lastrowid


def list_actions(
    status: Optional[str] = "next",
    context_id: Optional[int] = None,
    project_id: Optional[int] = None,
) -> list[sqlite3.Row]:
    sql = [
        "SELECT a.*, c.name AS context_name, p.title AS project_title",
        "FROM actions a",
        "LEFT JOIN contexts c ON c.id = a.context_id",
        "LEFT JOIN projects p ON p.id = a.project_id",
        "WHERE 1=1",
    ]
    params: list = []
    if status is not None:
        sql.append("AND a.status = ?")
        params.append(status)
    if context_id is not None:
        sql.append("AND a.context_id = ?")
        params.append(context_id)
    if project_id is not None:
        sql.append("AND a.project_id = ?")
        params.append(project_id)
    sql.append("ORDER BY (a.due_date IS NULL), a.due_date, a.created_at")
    return get_conn().execute(" ".join(sql), params).fetchall()


def complete_action(action_id: int) -> None:
    with tx() as conn:
        conn.execute(
            "UPDATE actions SET status = 'done', completed_at = ? WHERE id = ?",
            (now_iso(), action_id),
        )


def set_action_status(action_id: int, status: str) -> None:
    completed_at = now_iso() if status == "done" else None
    with tx() as conn:
        conn.execute(
            "UPDATE actions SET status = ?, completed_at = ? WHERE id = ?",
            (status, completed_at, action_id),
        )


def delete_action(action_id: int) -> None:
    with tx() as conn:
        conn.execute("DELETE FROM actions WHERE id = ?", (action_id,))


# --- Reference --------------------------------------------------------------

def add_reference(title: str, body: str = "") -> int:
    title = title.strip()
    if not title:
        raise ValueError("Reference title required")
    with tx() as conn:
        cur = conn.execute(
            "INSERT INTO reference_items (title, body, created_at) VALUES (?, ?, ?)",
            (title, body.strip(), now_iso()),
        )
        return cur.lastrowid


def list_reference() -> list[sqlite3.Row]:
    return get_conn().execute(
        "SELECT * FROM reference_items ORDER BY created_at DESC"
    ).fetchall()


def delete_reference(ref_id: int) -> None:
    with tx() as conn:
        conn.execute("DELETE FROM reference_items WHERE id = ?", (ref_id,))


# --- Review log -------------------------------------------------------------

def log_review(kind: str, notes: str = "") -> int:
    with tx() as conn:
        cur = conn.execute(
            "INSERT INTO review_log (kind, completed_at, notes) VALUES (?, ?, ?)",
            (kind, now_iso(), notes.strip()),
        )
        return cur.lastrowid


def last_review(kind: str = "weekly") -> Optional[sqlite3.Row]:
    return get_conn().execute(
        "SELECT * FROM review_log WHERE kind = ? ORDER BY completed_at DESC LIMIT 1",
        (kind,),
    ).fetchone()
