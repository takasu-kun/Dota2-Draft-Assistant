<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getHeroBuild } from "../api/builds";
import type { BuildItem, HeroBuild } from "../api/types";
import HeroSelector from "../components/heroes/HeroSelector.vue";

const route = useRoute();
const heroId = ref<number | null>(null);
const build = ref<HeroBuild | null>(null);
const loading = ref(false);
const error = ref("");

async function load() {
  if (!heroId.value) return;
  loading.value = true;
  error.value = "";
  build.value = null;
  try {
    build.value = await getHeroBuild(heroId.value);
  } catch {
    error.value = "Unable to load suggested builds for this hero.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const q = route.query.hero;
  const id = typeof q === "string" ? Number(q) : NaN;
  if (Number.isInteger(id) && id > 0) heroId.value = id;
});
watch(heroId, load);

const SECTIONS: { key: keyof HeroBuild; title: string }[] = [
  { key: "startingItems", title: "Starting Items" },
  { key: "earlyItems", title: "Early Game" },
  { key: "coreItems", title: "Core Items" },
  { key: "situationalItems", title: "Situational" },
];
function items(b: HeroBuild, key: keyof HeroBuild): BuildItem[] {
  return b[key] as BuildItem[];
}
</script>
<template>
  <div class="standard-page">
    <div class="page-head">
      <div>
        <h1>Hero Builds</h1>
        <p>Common item builds for a hero, aggregated from real OpenDota match data.</p>
      </div>
    </div>
    <HeroSelector v-model="heroId" />

    <p v-if="!heroId" class="analysis-empty">Select a hero to see suggested builds.</p>
    <p v-else-if="error" class="api-error">{{ error }} <button @click="load">Retry</button></p>
    <div v-else-if="loading" class="build-grid">
      <div v-for="n in 4" :key="n" class="panel build-section skeleton"><div></div></div>
    </div>
    <p
      v-else-if="
        build &&
        !build.startingItems.length &&
        !build.earlyItems.length &&
        !build.coreItems.length &&
        !build.situationalItems.length
      "
      class="analysis-empty"
    >
      Not enough match data to generate a build for this hero.
    </p>
    <template v-else-if="build">
      <p class="match-sample">
        Based on ~{{ build.sampleSize }} recent professional matches.
        <span v-if="build.lowConfidence" class="low-confidence"
          >Limited match data available - treat this build as a rough guide, not a certainty.</span
        >
      </p>
      <div class="build-grid">
        <article v-for="section in SECTIONS" :key="section.key" class="panel build-section">
          <h2>{{ section.title }}</h2>
          <p v-if="!items(build, section.key).length" class="analysis-empty small">
            No data for this category.
          </p>
          <div v-for="item in items(build, section.key)" :key="item.itemId" class="build-item">
            <img v-if="item.image" :src="item.image" :alt="item.name" class="item-icon" />
            <span class="item-name">{{ item.name }}</span>
            <i class="item-bar"><em :style="{ width: item.percentage + '%' }"></em></i>
            <strong>{{ item.percentage }}%</strong>
          </div>
        </article>
      </div>
      <p class="build-note">
        Skill build and talent picks aren't available from OpenDota's public API, so they aren't
        shown here.
      </p>
    </template>
  </div>
</template>
