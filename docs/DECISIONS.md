# Decisions and issues

A short log of notable decisions and problems, with root cause and fix. Newest last.

## Lessons carried over from the kanban project

These were found the hard way in `../kanban` (see its `docs/DECISIONS.md`) and apply here too:

- `cacheComponents` and `partialPrefetching` enable PPR, which `output: "export"` rejects. Leave them out of `next.config.ts`.
- A `useEffect` with an expression body (`() => ref.current?.scrollIntoView?.()`) returns a value React treats as cleanup and crashes. Use block bodies.
- An element with `visibility: hidden` mid-transition cannot take focus. Transition `visibility` only on close for drawers.
- Make a small grip the only drag activator; a whole-card drag handle nests the Edit and Delete buttons inside `role="button"`.
- The AI chat must re-read the board after the model replies and refuse to save if it changed, or user edits made during the wait are lost.
- e2e: wait for the login response before reloading (scrypt is slow on purpose), and wait for entrance animations to finish before measuring drag handles.
- Next.js adds an empty `role="alert"` route announcer, so tests find error messages by text.

## UI on shadcn/ui (Part 1)

- Decision: the UI is built from shadcn/ui components and its CSS-variable theme instead of the kanban project's hand-written Tailwind components. The kanban brand colours and fonts are mapped onto shadcn's tokens, with light and dark themes.

## shadcn setup and theme mapping (Part 3)

- shadcn CLI 4 has no `new-york` style; it offers base libraries (Base UI, Radix, Aria) and presets. Chosen: Radix base, `nova` preset (`style: radix-nova`), the most widely documented combination.
- Colours: `#209dd7` on white is 3.06:1, too low for white button text, so it is the focus `ring` and purple (7.63:1 with white) is `primary`, matching how kanban used them (purple buttons, blue focus). Gold is a custom `highlight` token rather than shadcn's `accent`, which shadcn uses for subtle hover backgrounds. Dark theme values checked for AA as well.
- shadcn init left `--font-sans: var(--font-sans)` (self-reference, since the template layout defines Geist variables). Fixed by loading Inter and Manrope as `--font-inter` and `--font-manrope`.
- `create-next-app` enabled `cacheComponents` and `partialPrefetching` again; proven by `next build` failing with "PPR cannot be enabled in export mode". Removed.
- `npm i -D @vitejs/plugin-react` failed (ERESOLVE): its optional peer `@rolldown/plugin-babel` allows `@babel/plugin-transform-runtime` 8, which needs `@babel/core` 8, while shadcn and eslint use 7. The plugin is not needed for Vitest (Vite compiles TSX with `jsx: react-jsx`), so it was dropped instead of forcing the install.
- The header separator stuck to the top: measured `align-self: stretch` from shadcn's `data-vertical:self-stretch`, whose attribute selector beats a plain `self-center`. Fixed with `data-vertical:self-center`.
- Coverage excludes `src/components/ui/` (generated library code) and `src/app/` (wiring).

## Accounts backend (Part 5)

- Migrations instead of drop and recreate (approved in Part 4): `db.MIGRATIONS` is an append-only list of SQL scripts applied on startup, each in `BEGIN ... PRAGMA user_version = n; COMMIT`. A failing script raises, `connect()` rolls it back, and the version is unchanged (covered by a test).
- New users start with "My first board" and the 8 demo cards (user's choice in Part 4).
- Auth is the kanban implementation unchanged: scrypt hashes, SQLite sessions, HttpOnly SameSite=lax cookie. Verified in the container that a session survives a stop and rebuild.
- Coverage is enforced with `fail_under = 100` in `pyproject.toml`.

## Accounts frontend (Part 6)

- Account actions use shadcn primitives: DropdownMenu for the menu, Dialog for change password, AlertDialog for delete account (it asks for the password, so the destructive button is a submit button rather than `AlertDialogAction`, which would close the dialog before the server answers). Success is confirmed with Sonner toasts.
- The account button's accessible name is "Account <username>", so it contains the visible username (label in name).
- Radix needs `ResizeObserver`, pointer capture and `scrollIntoView` in jsdom; stubbed in `vitest.setup.ts`. With those, the menu and dialogs are tested with real clicks.
- Verified in Playwright that the menu and dialogs work from the keyboard and that focus returns to the account button when a dialog closes.

## Boards backend (Part 7)

- Ported unchanged from kanban (`boards.py`, the board functions in `db.py`, `test_boards.py`): whole-board PUT, per-user scoping (404), id reuse across boards rejected by the primary keys (409).

## Kanban board frontend (Part 8)

- shadcn pieces: DropdownMenu board switcher, Dialog for new board and card editing (Calendar in a Popover for the due date, Select for priority), AlertDialog for deleting boards and non-empty columns, Badge chips, Progress for "N of M done", Sonner toasts for failures. Cards are added inline (title only, field stays open) for quick entry; everything else is in the edit dialog.
- No entrance animations: in kanban they made drag tests flaky (the grip moved while animating). The board is static, so the e2e drag helper needs no waiting.
- Bug found by a unit test: "Rename board" focused the name field while the menu was still open, and the menu's focus trap took focus back. Fix: start renaming in the menu's `onCloseAutoFocus` (after it releases focus) and prevent its default.
- Bug found by a flaky unit test: Workspace rendered a header while the first board loaded, then Board rendered its own, so the header was replaced under the user (an open account menu closed; tests held detached elements). Fix: Workspace renders nothing until the board has loaded (milliseconds), as kanban did.
- Layout found in screenshots: the board scroller's snap points ignored its padding, so it snapped 16px and the first column touched the edge (fixed with matching `scroll-padding`); at 1440px the columns overflowed (minimum width lowered to kanban's 224px); on touch screens the always-visible Edit and Delete tray covered the end of titles (the text gets right padding when there is no hover).
- E2E isolation: the database persists between runs, so `resetBoard` restores the demo user's board before tests that depend on it. It signs the browser in as the demo user, so a test that then signs in as someone else first signs out through the API.
- Drag handlers are unit tested by capturing the props passed to a mocked `DndContext`; a realistic drop after a cross-column drag-over is "over itself", because dnd-kit has already moved the item.

## Dev mode

- `next dev` could not reach the API: the frontend calls `/api` on its own origin, and export mode does not allow rewrites, even in dev (bundled docs, static-exports guide). `next.config.ts` now sets `output: "export"` only for builds and, under `next dev`, rewrites `/api/*` to a local uvicorn (`API_URL`, default port 8002). Verified with the auth and board Playwright suites against http://localhost:3000, and the production build still exports.

## AI chat (Parts 9 and 10)

- Backend ported unchanged from kanban (`ai.py`, `chat.py`, `check_ai.py` and their tests), including the check that refuses to save an AI board when the user edited the board while the model was working. Live: `check_ai.py` answers 4; the 6 live tests pass; a manual run through the UI in the container added a high-priority card with a due date and label in about 8 seconds, and it was still there after a reload.
- The chat is a non-modal shadcn Sheet: Radix renders no overlay for a non-modal dialog, and outside clicks are prevented from closing it, so the board stays usable and the AI's changes are visible as they land. Focus goes to the message box on open (`onOpenAutoFocus`) and back to Ask AI on close.
- The conversation lives in a `useChat` hook owned by `Board`, not in the Sheet content (which unmounts when closed), so closing and reopening keeps it; switching boards resets it because Board is keyed by board id.
- A Playwright check that the panel fits a 375px screen failed at 400px. Measured cause: the panel was read mid-way through its slide-in animation (it starts 40px off to the right). The test now waits for the panel's animations to finish; the layout was fine.

## Wrap up (Part 11)

- Removed unused generated components (`scroll-area`, `skeleton`) and the unused direct dependency `date-fns` (react-day-picker brings its own).
- `npm audit` flagged 4 moderate issues in production dependencies, all from the `shadcn` CLI package (ts-morph pulls an old minimatch). The app only imports `shadcn/tailwind.css` at build time, so `shadcn` moved to devDependencies; production dependencies now audit clean. The suggested `npm audit fix --force` would have downgraded shadcn to 1.0.0, so it was not used.
- Restored the `globals.css`, `ui/` and ThemeToggle entries in `frontend/AGENTS.md`, lost when its structure section was rewritten in Part 8.
