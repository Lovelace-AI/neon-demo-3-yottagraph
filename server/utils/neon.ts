import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;

export function isDbConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL);
}

export function getDb(): NeonQueryFunction<false, false> | null {
    if (_sql) return _sql;
    const url = process.env.DATABASE_URL;
    if (!url) return null;
    _sql = neon(url);
    return _sql;
}

let _initialized = false;

export async function ensureTables(): Promise<void> {
    if (_initialized) return;
    const sql = getDb();
    if (!sql) return;

    await sql`CREATE TABLE IF NOT EXISTS imported_entities (
        id SERIAL PRIMARY KEY,
        neid TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        flavor TEXT,
        score REAL,
        query TEXT,
        properties JSONB DEFAULT '{}'::jsonb,
        imported_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE INDEX IF NOT EXISTS imported_entities_name_idx ON imported_entities (LOWER(name))`;
    await sql`CREATE INDEX IF NOT EXISTS imported_entities_flavor_idx ON imported_entities (flavor)`;

    _initialized = true;
}
