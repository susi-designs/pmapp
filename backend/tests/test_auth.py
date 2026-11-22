from fastapi.testclient import TestClient

import db
from main import app


def register(client, username="alice", password="alice-pass"):
    return client.post("/api/register", json={"username": username, "password": password})


def count(table):
    with db.connect() as conn:
        return conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0]


def test_me_requires_a_session(client):
    assert client.get("/api/me").status_code == 401


def test_login_and_me(authed):
    assert authed.get("/api/me").json() == {"username": "user"}


def test_login_sets_an_httponly_cookie(client):
    r = client.post("/api/login", json={"username": "user", "password": "password"})
    cookie = r.headers["set-cookie"]
    assert "session=" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie


def test_login_ignores_username_case(client):
    assert client.post("/api/login", json={"username": "USER", "password": "password"}).json() == {"username": "user"}


def test_wrong_password_or_unknown_user(client):
    for creds in [{"username": "user", "password": "nope"}, {"username": "ghost", "password": "password"}]:
        r = client.post("/api/login", json=creds)
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid username or password"
    assert client.get("/api/me").status_code == 401


def test_logout(authed):
    assert authed.post("/api/logout").status_code == 200
    assert authed.get("/api/me").status_code == 401
    assert count("sessions") == 0


def test_logout_without_a_session(client):
    assert client.post("/api/logout").status_code == 200


def test_register_signs_in_and_creates_the_demo_board(client):
    r = register(client)
    assert r.status_code == 201
    assert r.json() == {"username": "alice"}
    assert client.get("/api/me").json() == {"username": "alice"}
    with db.connect() as conn:
        names = conn.execute(
            "SELECT boards.name FROM boards JOIN users ON users.id = boards.user_id WHERE username = 'alice'"
        ).fetchall()
    assert [n["name"] for n in names] == ["My first board"]


def test_register_trims_the_username(client):
    assert register(client, username="  alice  ").json() == {"username": "alice"}


def test_register_rejects_taken_names_in_any_case(client):
    register(client)
    for name in ["alice", "ALICE", "User"]:
        r = register(client, username=name)
        assert r.status_code == 409
        assert r.json()["detail"] == "That username is taken"


def test_register_validates_input(client):
    for username, password in [
        ("ab", "long-enough"),
        ("x" * 33, "long-enough"),
        ("bad name", "long-enough"),
        ("bad/name", "long-enough"),
        ("alice", "short"),
        ("alice", "x" * 129),
    ]:
        assert register(client, username, password).status_code == 422
    assert register(client, "a.b_c-1", "x" * 128).status_code == 201


def test_session_survives_an_app_restart(authed):
    cookie = authed.cookies["session"]
    with TestClient(app) as restarted:
        restarted.cookies["session"] = cookie
        assert restarted.get("/api/me").json() == {"username": "user"}


def test_expired_session_is_rejected_and_deleted(authed):
    with db.connect() as conn:
        conn.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00+00:00'")
    assert authed.get("/api/me").status_code == 401
    assert count("sessions") == 0


def test_change_password(authed):
    with TestClient(app) as other:
        other.post("/api/login", json={"username": "user", "password": "password"})
        r = authed.put("/api/me/password", json={"current": "password", "new": "new-password"})
        assert r.status_code == 200
        assert other.get("/api/me").status_code == 401  # other sessions are signed out
    assert authed.get("/api/me").status_code == 200  # this one stays
    assert authed.post("/api/login", json={"username": "user", "password": "password"}).status_code == 401
    assert authed.post("/api/login", json={"username": "user", "password": "new-password"}).status_code == 200


def test_change_password_needs_the_current_one(authed):
    r = authed.put("/api/me/password", json={"current": "wrong", "new": "new-password"})
    assert r.status_code == 403
    assert authed.put("/api/me/password", json={"current": "password", "new": "short"}).status_code == 422


def test_change_password_requires_a_session(client):
    assert client.put("/api/me/password", json={"current": "password", "new": "new-password"}).status_code == 401


def test_delete_account_removes_everything(client):
    register(client)
    assert client.request("DELETE", "/api/me", json={"password": "wrong"}).status_code == 403
    assert client.request("DELETE", "/api/me", json={"password": "alice-pass"}).status_code == 200
    assert client.get("/api/me").status_code == 401
    assert db.get_user("alice") is None
    assert (count("users"), count("boards"), count("columns"), count("cards")) == (1, 1, 5, len(db.SEED_CARDS))
