# Kanban

A product management app. Phase 1: Kanban boards with accounts, several boards per user, editable columns, card due dates, priorities and labels, and an AI assistant.

Requires Docker. Put `OPENROUTER_API_KEY` in `.env` in the project root.

## Run

- Mac / Linux: `scripts/start.sh` and `scripts/stop.sh`
- Windows: `scripts\start.bat` and `scripts\stop.bat`

The app is served at http://localhost:8001. Sign in with the demo account `user` / `password`, or create an account.

## Develop

```
cd backend && uv run --env-file ../.env uvicorn main:app --reload --port 8002
cd frontend && npm run dev    # http://localhost:3000, forwards /api to the backend
```

## Tests

Frontend (container must be running for e2e):

```
cd frontend
npm install
npm run test:coverage
npm run test:e2e
```

Backend:

```
cd backend
uv run pytest --cov                   # live AI tests are skipped
uv run --env-file ../.env pytest      # includes the live AI tests
```
