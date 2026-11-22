# Product Management App

## Business Requirements

A product management app, built in phases. Phase 1, a Kanban app, is complete.

### Phase 1: Kanban

- Users have accounts: anyone can create one (username and password) and sign in; users can change their password and delete their account. A demo account `user` / `password` always exists.
- Each user has any number of boards, which they can create, rename, switch between and delete.
- Columns can be added, renamed, reordered with drag and drop, and deleted.
- Cards can be added, edited, deleted and moved with drag and drop. Cards have a title and optional details, due date, priority and labels.
- An AI assistant in a side panel works on the open board: it can create, edit, move and delete cards (including their fields) and add, rename, reorder and delete columns, and answer questions about the board.
- Light and dark themes (following the system by default).

Limitations: runs locally in a Docker container. No admin role, board sharing, comments or activity history.

Later phases are planned with the user in `docs/PLAN.md`.

## Technical Decisions

- Next.js frontend (App Router, static export), React, TypeScript, Tailwind CSS 4
- UI: shadcn/ui for every component and the design system (theme tokens in `globals.css`). Use shadcn components before writing custom ones; add them with the shadcn CLI. Drag and drop with dnd-kit.
- Python FastAPI backend, which also serves the static Next.js site at `/`
- Everything packaged into one Docker container
- `uv` as the Python package manager
- SQLite database via stdlib `sqlite3`, created if it does not exist
- OpenRouter for AI calls, model `nvidia/nemotron-3.5-super-vl:free`; `OPENROUTER_API_KEY` in `.env` in the project root
- Start and stop scripts for Mac, Linux and Windows in `scripts/`
- Dev mode: `next dev` forwards `/api` to a local uvicorn (production builds are a static export, which does not allow rewrites)

## Coding standards

- Use the latest versions of libraries and idiomatic approaches as of today.
- Keep it simple: NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features.
- Be concise. Keep the README minimal. IMPORTANT: no emojis ever.
- When hitting issues, identify the root cause before trying a fix. Do not guess. Prove with evidence, then fix the root cause.

## Working documentation

Planning documents live in `docs/`. Review `docs/PLAN.md` before proceeding. Log notable decisions and issues (with root cause) in `docs/DECISIONS.md`. `frontend/AGENTS.md` and `backend/AGENTS.md` describe the code in each folder; keep them up to date when the code changes.
