import { ensureTables, getDb } from '../../utils/neon';

interface QueryBody {
    sql: string;
}

const DISALLOWED =
    /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|comment|vacuum|reindex|copy)\b/i;

export default defineEventHandler(async (event) => {
    const body = await readBody<QueryBody>(event);
    const text = (body?.sql || '').trim().replace(/;\s*$/, '');
    if (!text) {
        throw createError({ statusCode: 400, statusMessage: 'sql is required' });
    }
    if (text.includes(';')) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Only a single statement is allowed.',
        });
    }
    if (DISALLOWED.test(text)) {
        throw createError({
            statusCode: 400,
            statusMessage:
                'Read-only queries only. Use the Import tab to add data; mutations are blocked.',
        });
    }

    const sql = getDb();
    if (!sql) {
        throw createError({
            statusCode: 503,
            statusMessage: 'Database not configured (DATABASE_URL missing).',
        });
    }
    await ensureTables();

    const startedAt = Date.now();
    let result: any;
    try {
        result = await sql.query(text, [], { fullResults: true });
    } catch (err: any) {
        throw createError({
            statusCode: 400,
            statusMessage: err?.message || 'Query failed',
        });
    }
    const elapsedMs = Date.now() - startedAt;

    const fields: Array<{ name: string }> = (result?.fields ?? []).map((f: any) => ({
        name: f.name,
    }));
    const rows: Array<Record<string, unknown>> = result?.rows ?? [];
    const columns = fields.length
        ? fields.map((f) => f.name)
        : rows.length
          ? Object.keys(rows[0])
          : [];

    return {
        columns,
        rows,
        rowCount: typeof result?.rowCount === 'number' ? result.rowCount : rows.length,
        elapsedMs,
    };
});
