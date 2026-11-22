import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(autouse=True)
def db_path(tmp_path, monkeypatch):
    # A directory that does not exist yet, so startup must create it.
    path = tmp_path / "data" / "pmapp.db"
    monkeypatch.setenv("DB_PATH", str(path))
    return path


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def authed(client):
    """Signed in as the demo user."""
    assert client.post("/api/login", json={"username": "user", "password": "password"}).status_code == 200
    return client


@pytest.fixture
def board_id(authed):
    """The demo user's first board."""
    return authed.get("/api/boards").json()[0]["id"]


@pytest.fixture
def alice(client):
    """A second, separately signed-in user (needs `client` first so the app has started)."""
    with TestClient(app) as c:
        assert c.post("/api/register", json={"username": "alice", "password": "alice-pass"}).status_code == 201
        c.board_id = c.get("/api/boards").json()[0]["id"]
        yield c
