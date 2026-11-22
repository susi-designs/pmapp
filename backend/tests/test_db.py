import sqlite3

import pytest

import db


def tables(conn):
    return {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")} - {"sqlite_sequence"}


def test_creates_database_from_scratch(db_path):
    assert not db_path.parent.exists()
    db.init_db()
    assert db_path.exists()
    with db.connect() as conn:
        assert tables(conn) == {"users", "sessions", "boards", "columns", "cards"}
        assert conn.execute("PRAGMA user_version").fetchone()[0] == len(db.MIGRATIONS)
        assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"


def test_init_is_idempotent():
    db.init_db()
    db.init_db()
    with db.connect() as conn:
        assert conn.execute("SELECT count(*) FROM users").fetchone()[0] == 1


def test_new_migration_keeps_existing_data(monkeypatch):
    db.init_db()
    monkeypatch.setattr(db, "MIGRATIONS", [*db.MIGRATIONS, "CREATE TABLE extra (id INTEGER PRIMARY KEY);"])
    db.init_db()
    with db.connect() as conn:
        assert "extra" in tables(conn)
        assert conn.execute("PRAGMA user_version").fetchone()[0] == 2
        assert conn.execute("SELECT count(*) FROM users").fetchone()[0] == 1


def test_failed_migration_is_rolled_back(monkeypatch):
    db.init_db()
    monkeypatch.setattr(db, "MIGRATIONS", [*db.MIGRATIONS, "CREATE TABLE extra (id INTEGER); NOT SQL;"])
    with pytest.raises(sqlite3.OperationalError):
        db.init_db()
    with db.connect() as conn:
        assert "extra" not in tables(conn)
        assert conn.execute("PRAGMA user_version").fetchone()[0] == 1


def test_demo_user_gets_the_demo_board():
    db.init_db()
    user = db.get_user("user")
    assert db.check_password("password", user["password_hash"])
    with db.connect() as conn:
        boards = conn.execute("SELECT id, name FROM boards WHERE user_id = ?", (user["id"],)).fetchall()
        assert [b["name"] for b in boards] == ["My first board"]
        columns = conn.execute("SELECT title FROM columns WHERE board_id = ? ORDER BY position", (boards[0]["id"],))
        assert [c["title"] for c in columns] == db.DEFAULT_COLUMNS
        cards = conn.execute(
            "SELECT cards.title, cards.position, columns.position AS col FROM cards "
            "JOIN columns ON columns.id = cards.column_id ORDER BY col, cards.position"
        ).fetchall()
        assert [(c["col"], c["title"]) for c in cards] == [(col, title) for col, title, _ in db.SEED_CARDS]
        assert [c["position"] for c in cards if c["col"] == 0] == [0, 1]


def test_passwords_are_salted_hashes():
    first, second = db.hash_password("secret-pass"), db.hash_password("secret-pass")
    assert first != second and "secret-pass" not in first
    assert db.check_password("secret-pass", first)
    assert not db.check_password("wrong-pass", first)


def test_priority_is_checked_by_the_database():
    db.init_db()
    with pytest.raises(sqlite3.IntegrityError), db.connect() as conn:
        column = conn.execute("SELECT id FROM columns LIMIT 1").fetchone()["id"]
        conn.execute(
            "INSERT INTO cards (id, column_id, title, priority, position) VALUES ('x', ?, 't', 'urgent', 9)",
            (column,),
        )
