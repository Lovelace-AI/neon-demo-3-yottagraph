import { ensureTables, getDb } from '../../utils/neon';

interface ImportBody {
    query: string;
    maxResults?: number;
    flavors?: string[];
}

interface SearchMatch {
    neid: string;
    name?: string;
    score?: number;
    flavor?: string;
}

export default defineEventHandler(async (event) => {
    const body = await readBody<ImportBody>(event);
    const query = (body?.query || '').trim();
    if (!query) {
        throw createError({ statusCode: 400, statusMessage: 'query is required' });
    }
    const maxResults = Math.min(Math.max(body?.maxResults ?? 25, 1), 100);

    const sql = getDb();
    if (!sql) {
        throw createError({
            statusCode: 503,
            statusMessage: 'Database not configured (DATABASE_URL missing).',
        });
    }
    await ensureTables();

    const { public: config } = useRuntimeConfig();
    const gatewayUrl = (config as any).gatewayUrl as string;
    const orgId = (config as any).tenantOrgId as string;
    const apiKey = (config as any).qsApiKey as string;
    if (!gatewayUrl || !orgId) {
        throw createError({ statusCode: 503, statusMessage: 'Gateway not configured' });
    }

    const queryObj: Record<string, any> = { queryId: 1, query };
    if (body?.flavors?.length) queryObj.flavors = body.flavors;

    let searchRes: any;
    try {
        searchRes = await $fetch(`${gatewayUrl}/api/qs/${orgId}/entities/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey && { 'X-Api-Key': apiKey }),
            },
            body: {
                queries: [queryObj],
                maxResults,
                includeNames: true,
            },
        });
    } catch (err: any) {
        throw createError({
            statusCode: 502,
            statusMessage: `Elemental API error: ${err?.message || err}`,
        });
    }

    const matches: SearchMatch[] = searchRes?.results?.[0]?.matches ?? [];
    if (!matches.length) {
        return { query, fetched: 0, inserted: 0, updated: 0, rows: [] };
    }

    let inserted = 0;
    let updated = 0;
    const rows: Array<{
        neid: string;
        name: string;
        flavor: string | null;
        score: number | null;
    }> = [];

    for (const m of matches) {
        if (!m?.neid) continue;
        const name = m.name || m.neid;
        const flavor = m.flavor ?? null;
        const score = typeof m.score === 'number' ? m.score : null;

        const result = (await sql`
            INSERT INTO imported_entities (neid, name, flavor, score, query, properties)
            VALUES (${m.neid}, ${name}, ${flavor}, ${score}, ${query}, ${JSON.stringify(m)}::jsonb)
            ON CONFLICT (neid) DO UPDATE SET
                name = EXCLUDED.name,
                flavor = COALESCE(EXCLUDED.flavor, imported_entities.flavor),
                score = COALESCE(EXCLUDED.score, imported_entities.score),
                query = EXCLUDED.query,
                properties = EXCLUDED.properties,
                imported_at = NOW()
            RETURNING (xmax = 0) AS inserted
        `) as Array<{ inserted: boolean }>;

        if (result[0]?.inserted) inserted++;
        else updated++;
        rows.push({ neid: m.neid, name, flavor, score });
    }

    return { query, fetched: matches.length, inserted, updated, rows };
});
