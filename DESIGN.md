# neon-demo-3

## Vision

The app has two tabs. The first tab enables a user to query data from the API and write it to a Neon db. The second tab enables the user to write queries against that db and see the output.

## Status

Initial build complete. Two-tab single-page app on `/`:

1. **Import from API** — search the Lovelace knowledge graph by name and upsert
   matching entities into Neon (`imported_entities` table).
2. **Query Neon** — left-side schema browser of all `public.*` tables, plus a
   read-only SQL editor (Ctrl/⌘+Enter to run) with paginated results, example
   queries, and per-cell JSON formatting.

The backend gracefully degrades when `DATABASE_URL` is not set — a banner explains
the situation and the UI stays usable. On Vercel deploys with a Neon store
attached, `DATABASE_URL` is auto-injected and everything works end-to-end.

## Modules

### Frontend

- `pages/index.vue` — page shell, tab switching, DB status banner.
- `components/ImportTab.vue` — search form + recent-imports table (`v-data-table`).
- `components/QueryTab.vue` — schema browser + SQL editor + result table.

### Backend (`server/api/db/`)

- `status.get.ts` — reports whether `DATABASE_URL` is configured and the row
  count of `imported_entities`.
- `import.post.ts` — calls the gateway's `entities/search` endpoint and upserts
  matches into Neon. Returns counts of inserted/updated rows.
- `entities.get.ts` — recent imported entities (top 200, newest first).
- `tables.get.ts` — schema introspection: tables under `public`, columns, and
  per-table `COUNT(*)`.
- `query.post.ts` — runs a single read-only SQL statement via `sql.query()`
  with `fullResults: true`. Blocks `INSERT/UPDATE/DELETE/DROP/...` so the SQL
  console can't be used to mutate the database (use the Import tab instead).

### Storage

- `server/utils/neon.ts` — lazy `getDb()`, `isDbConfigured()`, and
  `ensureTables()` (creates `imported_entities` with name/flavor indexes on
  first use). Returns `null` instead of throwing when `DATABASE_URL` is unset.

### Schema

```sql
CREATE TABLE imported_entities (
    id           SERIAL PRIMARY KEY,
    neid         TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    flavor       TEXT,
    score        REAL,
    query        TEXT,            -- the search term that imported the row
    properties   JSONB,           -- the raw match payload from the API
    imported_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Imports use `ON CONFLICT (neid) DO UPDATE` so re-running a query refreshes
existing rows instead of duplicating them.
