<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getHeroMatches } from "../api/matches";
import type { HeroMatch } from "../api/types";
import { ApiError } from "../api/client";
import HeroSelector from "../components/heroes/HeroSelector.vue";

const route = useRoute();
const heroId = ref<number | null>(null);
const matches = ref<HeroMatch[]>([]);
const total = ref(0);
const hasMore = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref("");

const PAGE_SIZE = 15;

async function load() {
  if (!heroId.value) return;
  loading.value = true;
  error.value = "";
  matches.value = [];
  try {
    const page = await getHeroMatches(heroId.value, { limit: PAGE_SIZE, offset: 0 });
    matches.value = page.matches;
    total.value = page.total;
    hasMore.value = page.hasMore;
  } catch (e) {
    error.value =
      e instanceof ApiError ? e.message : "Unable to load recent matches for this hero.";
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!heroId.value || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const page = await getHeroMatches(heroId.value, {
      limit: PAGE_SIZE,
      offset: matches.value.length,
    });
    matches.value = [...matches.value, ...page.matches];
    hasMore.value = page.hasMore;
  } catch {
    error.value = "Unable to load more matches right now.";
  } finally {
    loadingMore.value = false;
  }
}

onMounted(() => {
  const q = route.query.hero;
  const id = typeof q === "string" ? Number(q) : NaN;
  if (Number.isInteger(id) && id > 0) heroId.value = id;
});
watch(heroId, load);

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const isEmpty = computed(
  () => !loading.value && !error.value && heroId.value !== null && matches.value.length === 0,
);
</script>
<template>
  <div class="standard-page">
    <div class="page-head">
      <div>
        <h1>Hero Matches</h1>
        <p>Recent professional matches for a hero, from OpenDota's match history.</p>
      </div>
    </div>
    <HeroSelector v-model="heroId" />

    <p v-if="!heroId" class="analysis-empty">Select a hero to see their recent matches.</p>
    <p v-else-if="error" class="api-error">{{ error }} <button @click="load">Retry</button></p>
    <template v-else-if="loading">
      <div class="match-table">
        <div v-for="n in 6" :key="n" class="match-row skeleton"><div></div></div>
      </div>
    </template>
    <p v-else-if="isEmpty" class="analysis-empty">No recent matches found for this hero.</p>
    <template v-else>
      <p class="match-sample">Showing {{ matches.length }} of {{ total }} recent matches.</p>
      <div class="match-table">
        <div class="match-row match-head">
          <span>Match</span><span>Result</span><span>K / D / A</span><span>Duration</span
          ><span>Date</span>
        </div>
        <div v-for="m in matches" :key="m.matchId" class="match-row">
          <span class="match-id">{{ m.matchId }}</span>
          <span :class="['result-badge', m.win ? 'win' : 'loss']">{{
            m.win ? "Win" : "Loss"
          }}</span>
          <span>{{ m.kills }} / {{ m.deaths }} / {{ m.assists }}</span>
          <span>{{ formatDuration(m.duration) }}</span>
          <span>
            {{ formatDate(m.startTime) }}
            <small v-if="m.leagueName">{{ m.leagueName }}</small>
          </span>
        </div>
      </div>
      <button
        v-if="hasMore"
        type="button"
        class="load-more"
        :disabled="loadingMore"
        @click="loadMore"
      >
        {{ loadingMore ? "Loading…" : "Load More" }}
      </button>
    </template>
  </div>
</template>
