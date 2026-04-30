<template>
    <div class="d-flex flex-column fill-height">
        <div class="flex-shrink-0 px-4 pt-4">
            <PageHeader title="Neon Demo" icon="mdi-database-arrow-down" />
            <v-tabs v-model="tab" color="primary" class="mt-2">
                <v-tab value="import">
                    <v-icon start>mdi-database-import</v-icon>
                    Import from API
                </v-tab>
                <v-tab value="query">
                    <v-icon start>mdi-database-search</v-icon>
                    Query Neon
                </v-tab>
            </v-tabs>
            <v-divider />
        </div>

        <div class="flex-grow-1 overflow-y-auto pa-4">
            <v-alert
                v-if="!dbAvailable"
                type="warning"
                variant="tonal"
                class="mb-4"
                density="comfortable"
            >
                <div class="font-weight-medium mb-1">Neon Postgres is not configured.</div>
                <div class="text-caption">
                    {{
                        dbStatusReason ||
                        'DATABASE_URL is missing in this environment. The app will work once a Neon store is connected via the Vercel deployment.'
                    }}
                </div>
            </v-alert>

            <v-tabs-window v-model="tab">
                <v-tabs-window-item value="import">
                    <ImportTab @imported="onImported" />
                </v-tabs-window-item>
                <v-tabs-window-item value="query">
                    <QueryTab :refresh-token="queryRefreshToken" />
                </v-tabs-window-item>
            </v-tabs-window>
        </div>
    </div>
</template>

<script setup lang="ts">
    const tab = ref<'import' | 'query'>('import');
    const queryRefreshToken = ref(0);
    const dbAvailable = ref(true);
    const dbStatusReason = ref<string | null>(null);

    async function refreshDbStatus() {
        try {
            const res = await $fetch<{ available: boolean; reason?: string }>('/api/db/status');
            dbAvailable.value = res.available;
            dbStatusReason.value = res.reason || null;
        } catch (err: any) {
            dbAvailable.value = false;
            dbStatusReason.value = err?.message || 'Failed to reach status endpoint.';
        }
    }

    function onImported() {
        queryRefreshToken.value++;
        refreshDbStatus();
    }

    onMounted(refreshDbStatus);
</script>
