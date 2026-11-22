# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read `AGENTS.md` (requirements, technical decisions, coding standards) and `docs/PLAN.md` before changing code. Also read `frontend/AGENTS.md` and `backend/AGENTS.md`, and keep them up to date. `docs/DECISIONS.md` logs past decisions and issues with root causes.

Next.js 16 has breaking changes: read `frontend/node_modules/next/dist/docs/` before writing Next code. For UI, use shadcn/ui components (add them with `npx shadcn@latest add <name>` in `frontend/`) and the theme tokens; do not hand-roll components shadcn already provides.

## Commands

Run the app (Docker required; `.env` in the project root): `scripts/start.sh` / `scripts/stop.sh` (`.bat` on Windows). Serves at http://localhost:8001.

Dev mode with hot reload (two terminals): `cd backend && uv run --env-file ../.env uvicorn main:app --reload --port 8002`, then `cd frontend && npm run dev` (http://localhost:3000; `next dev` forwards `/api` to `API_URL`, default http://localhost:8002). Dev uses the local database `backend/data/pmapp.db`, separate from the container's.

Frontend (`cd frontend`):
- `npm run lint`, `npx tsc --noEmit`
- `npm test` (Vitest); single file: `npx vitest run src/components/App.test.tsx`
- `npm run test:coverage` (80 percent threshold)
- `npm run test:e2e` (Playwright; needs the container running; `BASE_URL` overrides the port; single file: `npx playwright test e2e/auth.spec.ts`)

Backend (`cd backend`): `uv run pytest --cov` (fails below 100 percent coverage; live AI tests skipped); `uv run --env-file ../.env pytest` also runs the live model tests (slow, can be flaky); single test: `uv run pytest tests/test_auth.py -k name`.

## Architecture

One Docker image: the Next.js app is built as a static export and copied into the FastAPI backend's `static/`, which FastAPI serves at `/`. The JSON API lives under `/api`.

- Database: SQLite via stdlib `sqlite3` in `backend/db.py` (`DB_PATH`), with append-only `MIGRATIONS` tracked in `PRAGMA user_version`. See `docs/DATABASE.md`.
- Auth: `backend/auth.py`; scrypt password hashes, sessions in SQLite, HttpOnly `session` cookie; `auth.current_user` guards protected routes (401 means signed out). Demo account `user` / `password`. Frontend auth gate: `frontend/src/components/App.tsx`.
- AI chat: `POST /api/boards/{id}/chat` (`backend/chat.py`) sends the system prompt with the board JSON plus history to OpenRouter (`openai` SDK, Structured Outputs, `OPENROUTER_API_KEY` from `.env`). The model sees and returns cards nested in columns; the backend maps back, assigns uuids, validates, refuses to save if the board changed meanwhile, saves, and returns the board only if changed. The frontend (`Chat.tsx`, a non-modal Sheet) replaces its state with it without a PUT.
- Boards: any number per user; `PUT /api/boards/{id}` replaces the whole board; the frontend saves optimistically through an ordered queue, and drags save once on drop. Another user's board is a 404; reusing another board's ids is a 409.

The frontend uses shadcn/ui (Radix base) with the brand theme in `frontend/src/app/globals.css`, light and dark via next-themes.
