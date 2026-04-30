import { ensureTables, getDb, isDbConfigured } from '../../utils/neon';

interface TableInfo {
    name: string;
    columns: Array<{ name: string; type: string }>;
    rowCount: number;
}

export default defineEventHandler(async () => {
    if (!isDbConfigured()) return { available: false, tables: [] as TableInfo[] };
    const sql = getDb();
    if (!sql) return { available: false, tables: [] as TableInfo[] };
    await ensureTables();

    const tableRows = (await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    `) as Array<{ table_name: string }>;

    const tables: TableInfo[] = [];
    for (const t of tableRows) {
        const cols = (await sql`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ${t.table_name}
            ORDER BY ordinal_position
        `) as Array<{ column_name: string; data_type: string }>;

        let rowCount = 0;
        try {
            const safeName = t.table_name.replace(/[^A-Za-z0-9_]/g, '');
            const c = (await sql.query(
                `SELECT COUNT(*)::int AS count FROM "${safeName}"`,
                []
            )) as Array<{ count: number }>;
            rowCount = c[0]?.count ?? 0;
        } catch {
            rowCount = 0;
        }

        tables.push({
            name: t.table_name,
            columns: cols.map((c) => ({ name: c.column_name, type: c.data_type })),
            rowCount,
        });
    }

    return { available: true, tables };
});
