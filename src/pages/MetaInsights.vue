<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getMeta, getRoleRankings } from "../api/meta";
import type { Hero, Meta, RoleRanking } from "../api/types";
import { ROLE_LABELS } from "../constants/roles";

const meta = ref<Meta | null>(null);
const loading = ref(true);
const error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    meta.value = await getMeta();
  } catch {
    error.value = "Unable to load meta insights. Please try again.";
  } finally {
    loading.value = false;
  }
}
onMounted(load);

// Real position-data lookups (see server/src/services/roleFitService.ts) -
// noticeably slower than the rest of this page, so it loads independently
// instead of blocking everything else behind it.
const roleRankings = ref<RoleRanking[] | null>(null);
const roleRankingsLoading = ref(true);
const roleRankingsError = ref("");
async function loadRoleRankings() {
  roleRankingsLoading.value = true;
  roleRankingsError.value = "";
  try {
    roleRankings.value = await getRoleRankings();
  } catch {
    roleRankingsError.value = "Unable to load role rankings.";
  } finally {
    roleRankingsLoading.value = false;
  }
}
onMounted(loadRoleRankings);

const highestWinRate = computed(() => meta.value?.heroes[0] ?? null);
const mostPicked = computed(() => meta.value?.topHeroes[0] ?? null);
const mostBanned = computed(() => {
  const heroes = meta.value?.heroes ?? [];
  return heroes.reduce<Hero | null>(
    (best, h) => ((h.banRate ?? 0) > (best?.banRate ?? -1) ? h : best),
    null,
  );
});

const ATTRIBUTE_LABELS: Record<string, string> = {
  strength: "Strength",
  agility: "Agility",
  intelligence: "Intelligence",
  universal: "Universal",
};
const attributeBreakdown = computed(() => {
  const heroes = meta.value?.heroes ?? [];
  const groups = new Map<string, { total: number; count: number }>();
  for (const h of heroes) {
    const g = groups.get(h.primaryAttribute) ?? { total: 0, count: 0 };
    g.total += h.pickRate ?? 0;
    g.count += 1;
    groups.set(h.primaryAttribute, g);
  }
  const rows = [...groups.entries()].map(([attribute, g]) => ({
    attribute,
    label: ATTRIBUTE_LABELS[attribute] ?? attribute,
    avgPickRate: g.count ? g.total / g.count : 0,
  }));
  const max = Math.max(1, ...rows.map((r) => r.avgPickRate));
  return rows.map((r) => ({ ...r, heightPct: Math.round((r.avgPickRate / max) * 100) }));
});
</script>
<template>
  <div class="standard-page">
    <div class="page-head">
      <div>
        <h1>Meta Insights</h1>
        <p>
          {{ meta ? `Patch ${meta.patch}` : "Loading current patch…" }} performance overview and
          role-specific trends.
        </p>
      </div>
    </div>
    <p v-if="error" class="api-error">{{ error }} <button @click="load">Retry</button></p>
    <template v-else-if="!loading && meta">
      <section class="metric-row">
        <article>
          <small>Highest Win Rate</small>
          <h2>{{ highestWinRate?.winRate?.toFixed(1) ?? "—" }}%</h2>
          <b>{{ highestWinRate?.name ?? "—" }}</b>
        </article>
        <article>
          <small>Most Picked</small>
          <h2>{{ mostPicked?.pickRate?.toFixed(1) ?? "—" }}%</h2>
          <b>{{ mostPicked?.name ?? "—" }}</b>
        </article>
        <article>
          <small>Most Banned</small>
          <h2>{{ mostBanned?.banRate?.toFixed(1) ?? "—" }}%</h2>
          <b>{{ mostBanned?.name ?? "—" }}</b>
        </article>
      </section>
      <section class="meta-grid">
        <article class="panel">
          <h2>Top Heroes</h2>
          <div v-for="(h, i) in meta.heroes.slice(0, 8)" :key="h.id" class="top-hero">
            <span>{{ i + 1 }}</span
            ><b>{{ h.name }}</b
            ><em>{{ h.winRate?.toFixed(1) ?? "—" }}% win rate</em>
          </div>
        </article>
        <article class="panel chart">
          <h2>Pick Rate by Attribute</h2>
          <div class="bars">
            <i
              v-for="row in attributeBreakdown"
              :key="row.attribute"
              :style="{ height: Math.max(6, row.heightPct) + '%' }"
              :title="`${row.label}: ${row.avgPickRate.toFixed(1)}% avg pick rate`"
            ></i>
          </div>
          <p>Average pick rate by primary attribute, current patch</p>
        </article>
        <article class="panel">
          <h2>Role Rankings</h2>
          <p v-if="roleRankingsLoading" class="analysis-empty small">
            Computing real position data…
          </p>
          <p v-else-if="roleRankingsError" class="api-error">
            {{ roleRankingsError }} <button @click="loadRoleRankings">Retry</button>
          </p>
          <div v-else v-for="x in roleRankings" :key="x.role" class="top-hero">
            <b>{{ ROLE_LABELS[x.role] }}</b
            ><span>{{ x.hero?.name ?? "Not enough data" }}</span
            ><em>{{ x.winRate !== null ? `${x.winRate.toFixed(1)}%` : "—" }}</em>
          </div>
        </article>
      </section>
    </template>
    <p v-else class="analysis-empty">Loading meta insights…</p>
  </div>
</template>
