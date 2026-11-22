# Database approach

Schema: see `schema.json` (SQLite, 5 tables: `users`, `sessions`, `boards`, `columns`, `cards`).

```
users 1--* sessions
users 1--* boards 1--* columns 1--* cards
```

## Approach

- SQLite via the Python stdlib `sqlite3`. No ORM.
- File path from env `DB_PATH`. In Docker it is `/data/pmapp.db` on the named volume `pmapp-data`, so data survives stopping and rebuilding the container. Locally it defaults to `backend/data/pmapp.db` (gitignored). Tests use a temp file in a folder that does not exist yet, which also proves the folder and file are created.
- On startup `init_db()` creates the folder and file if missing, applies migrations, and creates the demo account `user` / `password` if missing.
- `PRAGMA foreign_keys = ON` on every connection; WAL journal mode (set once, stored in the file) so reads do not block on a write. One connection per request; each write runs in a single transaction. Deleting a user cascades to their sessions, boards, columns and cards.

## Migrations

The app is built in phases, and later phases will add tables, so the kanban approach (drop and recreate the database when the version changes) would wipe data each phase. Instead:

- `db.py` holds `MIGRATIONS`, a list of SQL scripts. Script `n` moves the database from version `n` to `n + 1`. Script 0 creates the five tables above.
- `PRAGMA user_version` stores the current version. `init_db()` runs every script above it, in order, each in one transaction with its version bump.
- Scripts are never edited once they have been run on real data; changes are new scripts appended to the list.

This is about ten lines of code and needs no migration tool.

## Accounts

- Usernames are unique ignoring case (`COLLATE NOCASE`). Passwords are stored as salted scrypt hashes (`hashlib.scrypt`, n=2^14, r=8, p=1) and compared with `hmac.compare_digest`.
- Sessions are rows keyed by the sha256 of a random token; the browser holds the token in an HttpOnly cookie. They last 7 days; expired rows are deleted when sessions are checked. Changing the password deletes the user's other sessions.

## Data rules

- Ids for columns and cards are opaque uuid strings, globally unique. Board ids are integers. Positions are integers, rewritten from array order on every save.
- Every board query includes the user id, so another user's board behaves as if it does not exist (404).
- Saving (`PUT /api/boards/{id}`) is a whole-board replace in one transaction: delete the board's cards, delete columns that are no longer listed, update or insert the listed columns in order, insert the submitted cards with their positions. A column or card id already used by another board fails its primary key and is rejected (409), so ids cannot be taken over.
- Every board has at least one column. Due date, priority and labels are optional; priority is also guarded by a `CHECK` constraint.
- Labels are a JSON array on the card row rather than a table: there is no label management screen, and label colours are derived from the text.
- AI chat updates go through the same validation and save as `PUT`. The AI never chooses ids: new or unknown ids get a fresh uuid.
- Chat history is not stored; the frontend keeps it in memory.
