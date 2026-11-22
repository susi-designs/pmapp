import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path

DEFAULT_PATH = Path(__file__).parent / "data" / "pmapp.db"
SESSION_DAYS = 7

# Script n moves the database from version n to n + 1 (PRAGMA user_version). Append only; never edit a script that
# has run on real data.
MIGRATIONS = [
    """
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL
    );
    CREATE TABLE boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        position INTEGER NOT NULL
    );
    CREATE INDEX idx_boards_user ON boards(user_id, position);
    CREATE TABLE columns (
        id TEXT PRIMARY KEY,
        board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        position INTEGER NOT NULL
    );
    CREATE INDEX idx_columns_board ON columns(board_id, position);
    CREATE TABLE cards (
        id TEXT PRIMARY KEY,
        column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        due_date TEXT,
        priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
        labels TEXT NOT NULL DEFAULT '[]',
        position INTEGER NOT NULL
    );
    CREATE INDEX idx_cards_column ON cards(column_id, position);
    """,
]

DEMO_USER, DEMO_PASSWORD = "user", "password"
DEFAULT_COLUMNS = ["Backlog", "To Do", "In Progress", "Review", "Done"]
# (column index, title, details), in display order
SEED_CARDS = [
    (0, "Define product vision", "Draft a one-page summary of goals and target users."),
    (0, "Competitor research", "Review five similar tools and note strengths and gaps."),
    (1, "Design system tokens", "Colors, type scale and spacing for the new interface."),
    (1, "Onboarding flow", "Sketch the first-run experience in three steps."),
    (2, "Build settings page", "Profile, notifications and theme preferences."),
    (3, "Accessibility audit", "Keyboard navigation and contrast checks across screens."),
    (4, "Set up CI pipeline", "Run lint, tests and build on every pull request."),
    (4, "Launch landing page", "Hero, feature highlights and sign-up call to action."),
]


def _path() -> Path:
    return Path(os.environ.get("DB_PATH", DEFAULT_PATH))


@contextmanager
def connect():
    """One connection per call; commits on success, rolls back on error."""
    conn = sqlite3.connect(_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_db():
    """Create the database if missing, apply pending migrations, and create the demo account if missing."""
    _path().parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        for number, script in enumerate(MIGRATIONS[version:], start=version + 1):
            conn.executescript(f"BEGIN; {script} PRAGMA user_version = {number}; COMMIT;")
    if not get_user(DEMO_USER):
        create_user(DEMO_USER, DEMO_PASSWORD)


# Users and sessions


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str) -> bool:
    _, salt, digest = stored.split("$")
    actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
    return hmac.compare_digest(actual.hex(), digest)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_user(username: str, password: str) -> int:
    """Create a user with the demo board. Raises sqlite3.IntegrityError if the name is taken (in any case)."""
    with connect() as conn:
        user_id = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, hash_password(password))
        ).lastrowid
        _create_board(conn, user_id, "My first board", demo=True)
    return user_id


def get_user(username: str):
    with connect() as conn:
        row = conn.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (username,)).fetchone()
    return dict(row) if row else None


def set_password(user_id: int, password: str):
    with connect() as conn:
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(password), user_id))


def delete_user(user_id: int):
    with connect() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(UTC) + timedelta(days=SESSION_DAYS)
    with connect() as conn:
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (_token_hash(token), user_id, expires.isoformat()),
        )
    return token


def session_user(token: str):
    """The signed-in user ({id, username}) for a session token, or None. Expired sessions are deleted."""
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (datetime.now(UTC).isoformat(),))
        row = conn.execute(
            "SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id "
            "WHERE sessions.token_hash = ?",
            (_token_hash(token),),
        ).fetchone()
    return dict(row) if row else None


def delete_session(token: str):
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))


def delete_other_sessions(user_id: int, keep_token: str):
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", (user_id, _token_hash(keep_token)))


# Boards


def _create_board(conn, user_id, name, demo=False):
    position = conn.execute(
        "SELECT COALESCE(MAX(position) + 1, 0) FROM boards WHERE user_id = ?", (user_id,)
    ).fetchone()[0]
    board_id = conn.execute(
        "INSERT INTO boards (user_id, name, position) VALUES (?, ?, ?)", (user_id, name, position)
    ).lastrowid
    column_ids = [str(uuid.uuid4()) for _ in DEFAULT_COLUMNS]
    conn.executemany(
        "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
        [(cid, board_id, title, pos) for pos, (cid, title) in enumerate(zip(column_ids, DEFAULT_COLUMNS))],
    )
    if demo:
        counts = [0] * len(DEFAULT_COLUMNS)
        for column, title, details in SEED_CARDS:
            conn.execute(
                "INSERT INTO cards (id, column_id, title, details, position) VALUES (?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), column_ids[column], title, details, counts[column]),
            )
            counts[column] += 1
    return {"id": board_id, "name": name}


def list_boards(user_id: int):
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, name FROM boards WHERE user_id = ? ORDER BY position, id", (user_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def create_board(user_id: int, name: str):
    with connect() as conn:
        return _create_board(conn, user_id, name)


def _owns(conn, user_id, board_id):
    return conn.execute("SELECT 1 FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)).fetchone()


def rename_board(user_id: int, board_id: int, name: str) -> bool:
    with connect() as conn:
        cursor = conn.execute("UPDATE boards SET name = ? WHERE id = ? AND user_id = ?", (name, board_id, user_id))
    return cursor.rowcount == 1


def delete_board(user_id: int, board_id: int) -> bool:
    with connect() as conn:
        cursor = conn.execute("DELETE FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id))
    return cursor.rowcount == 1


def get_board(user_id: int, board_id: int):
    """The board in the API shape, or None if the user does not own it."""
    with connect() as conn:
        if not _owns(conn, user_id, board_id):
            return None
        columns = conn.execute(
            "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position", (board_id,)
        ).fetchall()
        cards = conn.execute(
            "SELECT cards.* FROM cards JOIN columns ON columns.id = cards.column_id "
            "WHERE columns.board_id = ? ORDER BY cards.position",
            (board_id,),
        ).fetchall()
    card_ids = {c["id"]: [] for c in columns}
    for card in cards:
        card_ids[card["column_id"]].append(card["id"])
    return {
        "columns": [{"id": c["id"], "title": c["title"], "cardIds": card_ids[c["id"]]} for c in columns],
        "cards": {
            c["id"]: {
                "id": c["id"],
                "title": c["title"],
                "details": c["details"],
                "dueDate": c["due_date"],
                "priority": c["priority"],
                "labels": json.loads(c["labels"]),
            }
            for c in cards
        },
    }


def save_board(user_id: int, board_id: int, board: dict) -> bool:
    """Replace the board's columns and cards. Returns False if the user does not own the board.

    Columns missing from `board` are deleted with their cards and new column ids are inserted. A column or card id
    that belongs to another board fails its primary key (sqlite3.IntegrityError), so ids cannot be taken over.
    """
    with connect() as conn:
        if not _owns(conn, user_id, board_id):
            return False
        stored = {r["id"] for r in conn.execute("SELECT id FROM columns WHERE board_id = ?", (board_id,))}
        sent = {c["id"] for c in board["columns"]}
        conn.execute(
            "DELETE FROM cards WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?)", (board_id,)
        )
        for column_id in stored - sent:
            conn.execute("DELETE FROM columns WHERE id = ?", (column_id,))
        for position, column in enumerate(board["columns"]):
            if column["id"] in stored:
                conn.execute(
                    "UPDATE columns SET title = ?, position = ? WHERE id = ?",
                    (column["title"], position, column["id"]),
                )
            else:
                conn.execute(
                    "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
                    (column["id"], board_id, column["title"], position),
                )
            for card_position, card_id in enumerate(column["cardIds"]):
                card = board["cards"][card_id]
                conn.execute(
                    "INSERT INTO cards (id, column_id, title, details, due_date, priority, labels, position) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        card_id,
                        column["id"],
                        card["title"],
                        card["details"],
                        card["dueDate"],
                        card["priority"],
                        json.dumps(card["labels"]),
                        card_position,
                    ),
                )
    return True
