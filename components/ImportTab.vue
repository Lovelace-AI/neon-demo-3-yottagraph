<template>
    <div>
        <v-card variant="outlined" class="mb-4">
            <v-card-title class="text-subtitle-1">
                <v-icon start>mdi-magnify</v-icon>
                Search the Lovelace knowledge graph
            </v-card-title>
            <v-card-text>
                <p class="text-body-2 text-medium-emphasis mb-3">
                    Enter a search term (entity name, ticker, or topic). Matching entities are
                    written to the
                    <code>imported_entities</code> table in your Neon database. Existing rows are
                    upserted on conflict.
                </p>
                <v-form @submit.prevent="runImport">
                    <div class="d-flex flex-wrap ga-3 align-center">
                        <v-text-field
                            v-model="query"
                            label="Search query"
                            placeholder="e.g. Microsoft, Apple, JPMorgan"
                            variant="outlined"
                            density="comfortable"
                            hide-details
                            class="flex-grow-1"
                            style="min-width: 240px"
                            @keydown.enter.prevent="runImport"
                        />
                        <v-text-field
                            v-model.number="maxResults"
                            type="number"
                            label="Max results"
                            variant="outlined"
                            density="comfortable"
                            hide-details
                            min="1"
                            max="100"
                            style="width: 140px"
                        />
                        <v-btn
                            color="primary"
                            :loading="loading"
                            :disabled="!query.trim()"
                            type="submit"
                        >
                            <v-icon start>mdi-database-arrow-down</v-icon>
                            Import
                        </v-btn>
                    </div>
                </v-form>

                <v-alert
                    v-if="error"
                    type="error"
                    variant="tonal"
                    class="mt-4"
                    density="comfortable"
                    closable
                    @click:close="error = null"
                >
                    {{ error }}
                </v-alert>

                <v-alert
                    v-if="lastResult"
                    type="success"
                    variant="tonal"
                    class="mt-4"
                    density="comfortable"
                >
                    Fetched <strong>{{ lastResult.fetched }}</strong> result(s) for
                    <code>{{ lastResult.query }}</code> &mdash;
                    <strong>{{ lastResult.inserted }}</strong> inserted,
                    <strong>{{ lastResult.updated }}</strong> updated.
                </v-alert>
            </v-card-text>
        </v-card>

        <v-card variant="outlined">
            <v-card-title
                class="text-subtitle-1 d-flex align-center justify-space-between flex-wrap"
            >
                <div>
                    <v-icon start>mdi-table</v-icon>
                    Imported entities
                    <v-chip size="x-small" class="ml-2">{{ rows.length }}</v-chip>
                </div>
                <v-btn size="small" variant="text" :loading="listLoading" @click="loadEntities">
                    <v-icon start>mdi-refresh</v-icon>
                    Refresh
                </v-btn>
            </v-card-title>
            <v-data-table
                :headers="headers"
                :items="rows"
                :loading="listLoading"
                density="comfortable"
                hover
                :items-per-page="25"
            >
                <template v-slot:item.score="{ item }">
                    {{ item.score != null ? Number(item.score).toFixed(3) : '—' }}
                </template>
                <template v-slot:item.imported_at="{ item }">
                    {{ formatDate(item.imported_at) }}
                </template>
                <template v-slot:no-data>
                    <v-empty-state
                        headline="No imports yet"
                        text="Run a search above to populate the table."
                        icon="mdi-database-off"
                    />
                </template>
            </v-data-table>
        </v-card>
    </div>
</template>

<script setup lang="ts">
    interface ImportRow {
        id: number;
        neid: string;
        name: string;
        flavor: string | null;
        score: number | null;
        query: string | null;
        imported_at: string;
    }

    interface ImportResult {
        query: string;
        fetched: number;
        inserted: number;
        updated: number;
    }

    const emit = defineEmits<{ imported: [] }>();

    const query = ref('');
    const maxResults = ref(25);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const lastResult = ref<ImportResult | null>(null);

    const rows = ref<ImportRow[]>([]);
    const listLoading = ref(false);

    const headers = [
        { title: 'Name', key: 'name', sortable: true },
        { title: 'NEID', key: 'neid', sortable: false },
        { title: 'Flavor', key: 'flavor', sortable: true },
        { title: 'Score', key: 'score', sortable: true, width: 100 },
        { title: 'Query', key: 'query', sortable: true },
        { title: 'Imported', key: 'imported_at', sortable: true, width: 180 },
    ];

    function formatDate(s: string) {
        if (!s) return '';
        try {
            return new Date(s).toLocaleString();
        } catch {
            return s;
        }
    }

    async function runImport() {
        const q = query.value.trim();
        if (!q) return;
        loading.value = true;
        error.value = null;
        lastResult.value = null;
        try {
            const res = await $fetch<ImportResult>('/api/db/import', {
                method: 'POST',
                body: { query: q, maxResults: maxResults.value || 25 },
            });
            lastResult.value = res;
            emit('imported');
            await loadEntities();
        } catch (e: any) {
            error.value = e?.statusMessage || e?.data?.statusMessage || e?.message || String(e);
        } finally {
            loading.value = false;
        }
    }

    async function loadEntities() {
        listLoading.value = true;
        try {
            const res = await $fetch<{ available: boolean; rows: ImportRow[] }>('/api/db/entities');
            rows.value = res.rows || [];
        } catch (e: any) {
            error.value = e?.statusMessage || e?.message || 'Failed to load entities';
        } finally {
            listLoading.value = false;
        }
    }

    onMounted(loadEntities);
</script>
