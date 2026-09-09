<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getHeroMatches, getHeroMatchDetail } from "../api/matches";
import type { HeroMatch, HeroMatchDetail } from "../api/types";
import { ApiError } from "../api/client";
import HeroSelector from "../components/heroes/HeroSelector.vue";
import Modal from "../components/Modal.vue";

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
  selectedMatchId.value = null;
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

// Selected match: shows the hero's result/K-D-A/level for that specific
// match, plus the item purchase timeline for the player who played this
// hero in it (GET /api/heroes/:id/matches/:matchId).
const selectedMatchId = ref<number | null>(null);
const selectedDetail = ref<HeroMatchDetail | null>(null);
const detailLoading = ref(false);
const detailError = ref("");

async function selectMatch(matchId: number) {
  if (!heroId.value) return;
  selectedMatchId.value = matchId;
  selectedDetail.value = null;
  detailError.value = "";
  detailLoading.value = true;
  try {
    selectedDetail.value = await getHeroMatchDetail(heroId.value, matchId);
  } catch (e) {
    detailError.value =
      e instanceof ApiError ? e.message : "Unable to load the item build for this match.";
  } finally {
    detailLoading.value = false;
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
  const s = Math.abs(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function formatTimestamp(seconds: number): string {
  return seconds <= 0 ? "Pre-game" : formatDuration(seconds);
}
function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function itemTooltip(item: HeroMatchDetail["items"][number]): string {
  return `${item.name}\nPurchased: ${formatTimestamp(item.timestamp)}\nItem ID: ${item.itemId}\nMatch: #${selectedDetail.value?.matchId}`;
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
      <p class="match-sample">
        Showing {{ matches.length }} of {{ total }} recent matches. Select one to see its item
        build.
      </p>
      <div class="match-table">
        <div class="match-row match-head">
          <span>Match</span><span>Result</span><span>K / D / A</span><span>Duration</span
          ><span>Date</span>
        </div>
        <button
          v-for="m in matches"
          :key="m.matchId"
          type="button"
          :class="['match-row', 'match-row-clickable', { selected: m.matchId === selectedMatchId }]"
          @click="selectMatch(m.matchId)"
        >
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
        </button>
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

      <Modal v-if="selectedMatchId" class="selected-match" @close="selectedMatchId = null">
        <p v-if="detailLoading" class="analysis-empty small">Loading item build…</p>
        <p v-else-if="detailError" class="api-error">
          {{ detailError }} <button @click="selectMatch(selectedMatchId)">Retry</button>
        </p>
        <template v-else-if="selectedDetail">
          <header class="selected-match-head">
            <span :class="['result-badge', 'big', selectedDetail.win ? 'win' : 'loss']">{{
              selectedDetail.win ? "Win" : "Loss"
            }}</span>
            <div>
              <b>Match #{{ selectedDetail.matchId }}</b>
              <small>{{ formatDuration(selectedDetail.duration) }} duration</small>
            </div>
            <div>
              <b
                >{{ selectedDetail.kills }} / {{ selectedDetail.deaths }} /
                {{ selectedDetail.assists }}</b
              >
              <small>K / D / A</small>
            </div>
            <div v-if="selectedDetail.heroLevel !== null">
              <b>{{ selectedDetail.heroLevel }}</b>
              <small>Hero Level</small>
            </div>
          </header>
          <h3>Item Build</h3>
          <p v-if="!selectedDetail.items.length" class="analysis-empty small">
            No item purchase data is available for this match.
          </p>
          <ol v-else class="item-timeline">
            <li
              v-for="item in selectedDetail.items"
              :key="item.itemId + '-' + item.timestamp"
              :title="itemTooltip(item)"
            >
              <span class="timeline-time">{{ formatTimestamp(item.timestamp) }}</span>
              <img v-if="item.image" :src="item.image" :alt="item.name" class="item-icon" />
              <span class="item-name">{{ item.name }}</span>
              <span :class="['category-badge', item.category]">{{ item.category }}</span>
            </li>
          </ol>
        </template>
      </Modal>
    </template>
  </div>
</template>
