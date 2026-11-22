from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_hello():
    r = client.get("/api/hello")
    assert r.status_code == 200
    assert r.json() == {"message": "Hello from the API"}
