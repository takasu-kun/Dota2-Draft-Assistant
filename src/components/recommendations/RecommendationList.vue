<script setup lang="ts">
import { useRouter } from "vue-router";
import { useHeroCatalog } from "../../composables/useHeroCatalog";
import { useDraftState } from "../../composables/useDraftState";
import { usePreferences } from "../../composables/usePreferences";
import HeroPortrait from "../HeroPortrait.vue";

const { heroTone } = useHeroCatalog();
const { analysis, selectedRecommendationIndex, role } = useDraftState();
const { compactRecommendations } = usePreferences();
const router = useRouter();
</script>
<template>
  <section :class="['recommend-list', { compact: compactRecommendations }]">
    <header>
      <h2>Recommended Picks</h2>
      <a role="button" @click="router.push({ path: '/heroes', query: { role } })">View More</a>
    </header>
    <p v-if="!analysis" class="analysis-empty">Analyze your draft to see recommended picks.</p>
    <p v-else-if="!analysis.recommendations.length" class="analysis-empty">
      No recommendations available for this role right now.
    </p>
    <button
      v-else
      v-for="(rec, i) in analysis.recommendations"
      :key="rec.hero.id"
      type="button"
      :class="['rec-row', { featured: i === 0, selected: i === selectedRecommendationIndex }]"
      @click="selectedRecommendationIndex = i"
    >
      <span class="rank">{{ i + 1 }}</span>
      <div :class="['portrait', heroTone(rec.hero.id)]">
        <HeroPortrait :name="rec.hero.name" :image="rec.hero.image" />
      </div>
      <div class="rec-copy">
        <b>{{ rec.hero.name }}</b>
        <small
          ><span>{{ rec.hero.roles[0] ?? rec.hero.primaryAttribute }}</span
          ><span v-if="rec.hero.winRate !== null"
            >{{ rec.hero.winRate.toFixed(1) }}% WR</span
          ></small
        >
      </div>
      <div class="mini-ring">{{ rec.score }}</div>
    </button>
  </section>
</template>
