import { ensureTables, getDb, isDbConfigured } from '../../utils/neon';

export default defineEventHandler(async () => {
    if (!isDbConfigured()) {
        return { available: false, reason: 'DATABASE_URL is not set in this environment.' };
    }
    const sql = getDb();
    if (!sql) {
        return { available: false, reason: 'Could not initialize Neon client.' };
    }
    try {
        await ensureTables();
        const rows = (await sql`SELECT COUNT(*)::int AS count FROM imported_entities`) as Array<{
            count: number;
        }>;
        return { available: true, importedCount: rows[0]?.count ?? 0 };
    } catch (err: any) {
        return { available: false, reason: err?.message || 'Database error' };
    }
});
