# Project plan

Rules for the agent: tick checklist items as they are completed. After each part, stop and wait for the user's review before starting the next. Parts 1 and 4 require explicit user approval. Follow AGENTS.md (simple, no over-engineering, no emojis, shadcn/ui for the UI).

## Status

Phase 1 (Kanban) is complete: Parts 1 to 11 done. Final run on a rebuilt container: backend 102 pytest including the 6 live AI tests (100 percent coverage), frontend 55 Vitest (100 percent of lines, 93 percent of branches), 39 Playwright, a live AI request through the UI, and data surviving a container stop and rebuild. Next: plan phase 2 with the user.

## Decisions

- Architecture follows the earlier `../kanban` project, with the UI rebuilt on shadcn/ui.
- Layout: `frontend/` (Next.js), `backend/` (FastAPI, uv), `scripts/`, `Dockerfile` at the repo root, `docs/`.
- Docker: multi-stage. Stage 1 builds the Next.js static export (`output: "export"`). Stage 2 is Python with uv, copying the export into `backend/static`, which FastAPI serves at `/`. Runs as a non-root user. The port is published on `127.0.0.1:8001` only, so it does not clash with the kanban app on 8000. Container `pmapp`, data volume `pmapp-data`.
- UI: shadcn/ui (CLI `shadcn@latest`, Tailwind 4, Radix base with the `nova` preset, `lucide-react` icons), with light and dark themes through shadcn's CSS variables. Brand colours from the kanban project are mapped onto the shadcn tokens as kanban used them: purple `#753991` on `primary` (solid buttons), blue `#209dd7` on `ring` (focus), gold `#ecad0a` on a custom `highlight` token, navy `#032147` as foreground, ice blues for secondary, muted and accent. Fonts: Manrope for headings, Inter for body. Components used: alert-dialog, avatar, badge, button, calendar, card, dialog, dropdown-menu, input, label, popover, progress, select, separator, sheet, sonner, textarea, tooltip.
- Drag and drop: dnd-kit (shadcn has no Kanban primitive). A grip button is the only drag handle, so the card has no nested interactive content (lesson from kanban).
- API (all under `/api`): accounts (`/register`, `/login`, `/logout`, `/me`, `/me/password`), boards (`/boards`, `/boards/{id}`), AI chat (`/boards/{id}/chat`). Whole-board `PUT` replace, saved optimistically through an ordered queue on the frontend.
- Auth: salted scrypt password hashes (stdlib), sessions in SQLite (sha256 of the token, 7 days), HttpOnly `session` cookie. Demo account `user` / `password`.
- Database: SQLite via stdlib `sqlite3`, `DB_PATH` (`/data/pmapp.db` in Docker on volume `pmapp-data`; `backend/data/pmapp.db` locally). Schema version in `PRAGMA user_version`.
- AI: OpenRouter via the `openai` SDK with Structured Outputs, model `nvidia/nemotron-3.5-super-vl:free`. The model sees and returns cards nested in columns; the backend maps it back, assigns ids, validates, and refuses to save if the board changed while the model was working.
- Secrets: `.env` is gitignored and never copied into the image; passed at runtime with `--env-file`.
- Tests: backend pytest with 100 percent coverage (live AI tests skipped without a key); frontend Vitest with an 80 percent threshold; Playwright e2e against the running container.

## Part 1: Plan

- [x] Read the kanban project and carry over its architecture, standards and lessons (`docs/DECISIONS.md`)
- [x] Write `AGENTS.md`, `CLAUDE.md` and this plan
- [x] User reviews and approves this plan

Success: user approval.

## Part 2: Scaffolding

- [x] `git init`, `.gitignore`, `.dockerignore`
- [x] `backend/pyproject.toml` managed with uv (fastapi, uvicorn; dev: pytest, pytest-cov, httpx2)
- [x] `backend/main.py`: `GET /api/hello`, serves `backend/static/` at `/`
- [x] `Dockerfile` and `scripts/start.sh`, `stop.sh`, `start.bat`, `stop.bat`
- [x] Minimal README

Tests: pytest for `/api/hello`.
Success: the start script serves a page at http://localhost:8001 that calls `/api/hello` and shows the result; the stop script stops it.

## Part 3: Frontend and design system

- [x] `create-next-app` in `frontend/` (TypeScript, Tailwind 4, App Router, `src/`), static export, React Compiler; read `node_modules/next/dist/docs/` first and remove config that export mode rejects
- [x] `npx shadcn@latest init`; theme tokens with the brand colours (light and dark), fonts, and the base components listed above
- [x] App shell: one-row header (app name, board name placeholder, theme toggle, account placeholder) and an empty board area, built only from shadcn components
- [x] Dockerfile gains the Node build stage
- [x] Vitest (jsdom, Testing Library, v8 coverage, 80 percent threshold) and Playwright pointed at the container

Tests: Vitest smoke test of the shell; Playwright loads `/` from the container and sees the shell.
Success: the shadcn-themed shell is served from the container in light and dark mode.

## Part 4: Database modeling

- [x] Propose the schema in `docs/schema.json` (`users`, `sessions`, `boards`, `columns`, `cards` with `details`, `due_date`, `priority`, `labels`)
- [x] Document the approach in `docs/DATABASE.md` (file location, creation on startup, demo seed, ownership rules, whole-board save)
- [x] User reviews and signs off (new users start with demo cards)

Success: user approval of schema and approach.

## Part 5: Accounts (backend)

- [x] `backend/db.py`: tables, password hashing, users, sessions, demo user created on startup
- [x] `backend/auth.py`: register (username 3 to 32 of letters, digits, `.`, `_`, `-`, unique ignoring case; password 8 to 128 characters), login, logout, me, change password (signs out other sessions), delete account (cascade); `current_user` dependency

Tests: register ok, duplicate (case-insensitive), invalid input, login, wrong password, session survives a restart, expired session, logout, change password, delete account.

## Part 6: Accounts (frontend)

- [x] Auth gate on `GET /api/me`
- [x] Sign in / Create account screen (shadcn Card, Input, Label, Button; inline errors; rules as hints)
- [x] Account menu (Avatar plus DropdownMenu): Change password (Dialog), Delete account (AlertDialog asking for the password), Log out

Tests: unit tests for sign in, sign up, errors, change password, delete account. Playwright: sign up with a unique name, sign out and in, change password, delete account.

## Part 7: Boards, columns and cards (backend)

- [x] `GET`/`POST /api/boards`, `PATCH`/`DELETE /api/boards/{id}`, `GET`/`PUT /api/boards/{id}` (whole-board replace)
- [x] Validation with Pydantic: at least one column, every card listed once, `dueDate` ISO date, `priority` low/medium/high, up to 8 labels of 1 to 24 characters
- [x] Another user's board is a 404; a column or card id owned by another board is a 409. New users get a demo board.

Tests: board CRUD, ordering, per-user isolation, column add/delete/reorder through PUT, card field validation, id reuse rejected.

## Part 8: Kanban board (frontend)

- [x] Board switcher (DropdownMenu): list, New board, Rename (inline), Delete (AlertDialog naming the board); selected board in the URL hash; empty state with "Create board"
- [x] Columns: shadcn Card per column with click-to-rename title, card count, delete (confirm when it has cards), grip to reorder, "Add column" at the end
- [x] Cards: shadcn Card with grip, title, Badge chips for priority, due date (overdue and due today shown with text, not only colour) and labels; Edit and Delete on hover or focus
- [x] Card editor in a Dialog: title, details, due date (Popover plus Calendar), priority (Select), labels
- [x] dnd-kit for cards across columns and column reorder (pointer and keyboard, screen reader announcements); optimistic saves through an ordered queue; save failures shown with a Sonner toast
- [x] Header shows "N of M done"

Tests: unit tests for the pure board helpers, board actions, drag handlers, card chips (fixed clock). Playwright: board CRUD and switching, columns add/delete/drag, cards add/edit/delete/drag, persistence across reload.
Success: a signed-in user can run several boards end to end, and everything persists.

## Part 9: AI chat (backend)

- [x] `backend/ai.py`: OpenRouter call, key from env; manual connectivity check ("What is 2+2?")
- [x] `POST /api/boards/{id}/chat` `{message, history}`: system prompt with today's date and the board JSON; Structured Output `{message, board | null}`; validate and save; reply `BOARD_CHANGED` instead of overwriting concurrent edits

Tests: mocked model (plain reply, create, edit, move, column changes, invalid board rejected, history passed through, concurrent edit); live tests skipped without a key.

## Part 10: AI chat (frontend)

- [x] Chat in a shadcn Sheet opened by "Ask AI" in the header; focus moves into the message box and back on close
- [x] User message shown immediately; thinking and error states; suggestion buttons on an empty chat; Enter sends, Shift+Enter adds a line
- [x] A reply with a board replaces the board state (no PUT); switching boards resets the chat

Tests: unit tests (send, pending state, reply, board refresh, error). Playwright with the AI mocked at the network layer. One manual live check.

## Part 11: Wrap up

- [x] Update `AGENTS.md`, `CLAUDE.md` commands, `README.md`, `docs/DATABASE.md`, `frontend/AGENTS.md`, `backend/AGENTS.md`
- [x] Rebuild the container and run every suite; one live AI check

Success: all suites green; phase 1 Kanban app complete. Then plan phase 2 with the user.
