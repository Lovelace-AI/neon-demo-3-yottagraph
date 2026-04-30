<template>
    <div>
        <div class="d-flex flex-wrap ga-4">
            <v-card variant="outlined" class="flex-shrink-0" style="width: 320px">
                <v-card-title class="text-subtitle-1 d-flex align-center">
                    <v-icon start>mdi-table-multiple</v-icon>
                    Tables
                    <v-spacer />
                    <v-btn
                        icon="mdi-refresh"
                        size="x-small"
                        variant="text"
                        :loading="tablesLoading"
                        @click="loadTables"
                    />
                </v-card-title>
                <v-divider />
                <v-list density="compact" class="py-0">
                    <template v-if="tables.length">
                        <v-list-group v-for="t in tables" :key="t.name" :value="t.name">
                            <template v-slot:activator="{ props: itemProps }">
                                <v-list-item
                                    v-bind="itemProps"
                                    :title="t.name"
                                    :subtitle="`${t.rowCount} row${t.rowCount === 1 ? '' : 's'}`"
                                >
                                    <template v-slot:prepend>
                                        <v-icon size="small">mdi-table</v-icon>
                                    </template>
                                    <template v-slot:append>
                                        <v-btn
                                            size="x-small"
                                            variant="text"
                                            icon="mdi-content-copy"
                                            @click.stop="useSelect(t.name)"
                                        />
                                    </template>
                                </v-list-item>
                            </template>
                            <v-list-item
                                v-for="c in t.columns"
                                :key="c.name"
                                :title="c.name"
                                :subtitle="c.type"
                                density="compact"
                                class="pl-8"
                            >
                                <template v-slot:prepend>
                                    <v-icon size="x-small">mdi-key-variant</v-icon>
                                </template>
                            </v-list-item>
                        </v-list-group>
                    </template>
                    <v-list-item v-else>
                        <v-list-item-title class="text-medium-emphasis text-caption">
                            No tables yet. Import data from the first tab.
                        </v-list-item-title>
                    </v-list-item>
                </v-list>
            </v-card>

            <v-card variant="outlined" class="flex-grow-1" style="min-width: 360px">
                <v-card-title class="text-subtitle-1 d-flex align-center">
                    <v-icon start>mdi-console</v-icon>
                    SQL editor
                    <v-spacer />
                    <v-chip size="x-small" class="mr-2" variant="tonal">read-only</v-chip>
                    <v-btn size="small" color="primary" :loading="running" @click="runQuery">
                        <v-icon start>mdi-play</v-icon>
                        Run (Ctrl+Enter)
                    </v-btn>
                </v-card-title>
                <v-divider />
                <v-card-text>
                    <v-textarea
                        v-model="sqlText"
                        variant="outlined"
                        rows="6"
                        auto-grow
                        hide-details
                        class="sql-editor"
                        placeholder="SELECT * FROM imported_entities ORDER BY imported_at DESC LIMIT 50;"
                        @keydown.ctrl.enter.prevent="runQuery"
                        @keydown.meta.enter.prevent="runQuery"
                    />

                    <div class="d-flex flex-wrap ga-2 mt-3 align-center">
                        <span class="text-caption text-medium-emphasis mr-1">Examples:</span>
                        <v-btn
                            v-for="ex in examples"
                            :key="ex.label"
                            size="x-small"
                            variant="tonal"
                            @click="sqlText = ex.sql"
                        >
                            {{ ex.label }}
                        </v-btn>
                    </div>
                </v-card-text>

                <v-divider />

                <v-card-text>
                    <v-alert
                        v-if="error"
                        type="error"
                        variant="tonal"
                        class="mb-3"
                        density="comfortable"
                        closable
                        @click:close="error = null"
                    >
                        {{ error }}
                    </v-alert>

                    <div
                        v-if="result"
                        class="d-flex align-center text-caption text-medium-emphasis mb-2"
                    >
                        <v-icon size="small" class="mr-1">mdi-check-circle</v-icon>
                        <span>
                            {{ result.rowCount }} row{{ result.rowCount === 1 ? '' : 's' }} in
                            {{ result.elapsedMs }}ms
                        </span>
                    </div>

                    <div v-if="result" class="result-table-wrapper">
                        <v-data-table
                            :headers="resultHeaders"
                            :items="result.rows"
                            density="compact"
                            hover
                            :items-per-page="25"
                        >
                            <template
                                v-for="col in result.columns"
                                :key="col"
                                v-slot:[`item.${col}`]="{ item }"
                            >
                                <span class="cell-value">{{ formatCell(item[col]) }}</span>
                            </template>
                            <template v-slot:no-data>
                                <v-empty-state
                                    headline="Query returned no rows"
                                    icon="mdi-database-search-outline"
                                    density="compact"
                                />
                            </template>
                        </v-data-table>
                    </div>

                    <v-empty-state
                        v-else-if="!error && !running"
                        headline="Run a query to see results"
                        text="Try one of the example buttons above."
                        icon="mdi-console"
                        density="compact"
                    />
                </v-card-text>
            </v-card>
        </div>
    </div>
</template>

<script setup lang="ts">
    interface TableInfo {
        name: string;
        columns: Array<{ name: string; type: string }>;
        rowCount: number;
    }

    interface QueryResult {
        columns: string[];
        rows: Array<Record<string, unknown>>;
        rowCount: number;
        elapsedMs: number;
    }

    const props = defineProps<{ refreshToken?: number }>();

    const tables = ref<TableInfo[]>([]);
    const tablesLoading = ref(false);
    const sqlText = ref(
        'SELECT name, flavor, score, imported_at\nFROM imported_entities\nORDER BY imported_at DESC\nLIMIT 50;'
    );
    const running = ref(false);
    const error = ref<string | null>(null);
    const result = ref<QueryResult | null>(null);

    const examples = [
        {
            label: 'Recent imports',
            sql: 'SELECT name, flavor, score, imported_at\nFROM imported_entities\nORDER BY imported_at DESC\nLIMIT 50;',
        },
        {
            label: 'Count by flavor',
            sql: "SELECT COALESCE(flavor, '(unknown)') AS flavor, COUNT(*) AS n\nFROM imported_entities\nGROUP BY flavor\nORDER BY n DESC;",
        },
        {
            label: 'Top scored',
            sql: 'SELECT name, flavor, score\nFROM imported_entities\nWHERE score IS NOT NULL\nORDER BY score DESC\nLIMIT 25;',
        },
        {
            label: 'By query',
            sql: 'SELECT query, COUNT(*) AS n\nFROM imported_entities\nGROUP BY query\nORDER BY n DESC;',
        },
    ];

    const resultHeaders = computed(() =>
        (result.value?.columns ?? []).map((c) => ({
            title: c,
            key: c,
            sortable: true,
        }))
    );

    function formatCell(v: unknown): string {
        if (v === null || v === undefined) return '∅';
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
    }

    function useSelect(table: string) {
        const safe = table.replace(/[^A-Za-z0-9_]/g, '');
        sqlText.value = `SELECT * FROM "${safe}" LIMIT 50;`;
    }

    async function loadTables() {
        tablesLoading.value = true;
        try {
            const res = await $fetch<{ available: boolean; tables: TableInfo[] }>('/api/db/tables');
            tables.value = res.tables || [];
        } catch (e: any) {
            error.value = e?.statusMessage || e?.message || 'Failed to load tables';
        } finally {
            tablesLoading.value = false;
        }
    }

    async function runQuery() {
        const text = sqlText.value.trim();
        if (!text) return;
        running.value = true;
        error.value = null;
        try {
            const res = await $fetch<QueryResult>('/api/db/query', {
                method: 'POST',
                body: { sql: text },
            });
            result.value = res;
        } catch (e: any) {
            error.value =
                e?.data?.statusMessage || e?.statusMessage || e?.message || 'Query failed';
            result.value = null;
        } finally {
            running.value = false;
        }
    }

    watch(
        () => props.refreshToken,
        () => loadTables()
    );

    onMounted(loadTables);
</script>

<style scoped>
    .sql-editor :deep(textarea) {
        font-family: var(--font-mono, monospace);
        font-size: 0.85rem;
        line-height: 1.5;
    }

    .result-table-wrapper {
        max-height: 50vh;
        overflow: auto;
    }

    .cell-value {
        font-family: var(--font-mono, monospace);
        font-size: 0.8rem;
        white-space: nowrap;
    }
</style>
