import { getDb, isDbConfigured } from '../../utils/neon';

export default defineEventHandler(async () => {
    if (!isDbConfigured()) return { available: false, rows: [] };
    const sql = getDb();
    if (!sql) return { available: false, rows: [] };
    try {
        const rows = await sql`
            SELECT id, neid, name, flavor, score, query, imported_at
            FROM imported_entities
            ORDER BY imported_at DESC
            LIMIT 200
        `;
        return { available: true, rows };
    } catch (err: any) {
        if (err?.message?.includes('does not exist')) return { available: true, rows: [] };
        throw createError({
            statusCode: 500,
            statusMessage: err?.message || 'Failed to load entities',
        });
    }
});
