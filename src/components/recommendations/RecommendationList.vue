<script setup lang="ts">
import { useRouter } from "vue-router";
import { UserPlus, Check } from "lucide-vue-next";
import { useHeroCatalog } from "../../composables/useHeroCatalog";
import { useDraftState } from "../../composables/useDraftState";
import HeroPortrait from "../HeroPortrait.vue";

const { heroTone } = useHeroCatalog();
const { analysis, selectedRecommendationIndex, role, yourTeam, pickHero } = useDraftState();
const router = useRouter();

function onPick(event: Event, heroId: number) {
  event.stopPropagation();
  pickHero("your", heroId);
}
</script>
<template>
  <section class="recommend-list">
    <header>
      <h2>Recommended Picks</h2>
      <a role="button" @click="router.push({ path: '/heroes', query: { role } })">View More</a>
    </header>
    <p v-if="!analysis" class="analysis-empty">Analyze your draft to see recommended picks.</p>
    <p v-else-if="!analysis.recommendations.length" class="analysis-empty">
      No recommendations available for this role right now.
    </p>
    <div
      v-else
      v-for="(rec, i) in analysis.recommendations"
      :key="rec.hero.id"
      role="button"
      tabindex="0"
      :class="['rec-row', { featured: i === 0, selected: i === selectedRecommendationIndex }]"
      @click="selectedRecommendationIndex = i"
      @keydown.enter="selectedRecommendationIndex = i"
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
      <button
        v-if="yourTeam.includes(rec.hero.id)"
        type="button"
        class="pick-btn picked"
        disabled
        title="Already on your team"
      >
        <Check :size="14" />
      </button>
      <button
        v-else
        type="button"
        class="pick-btn"
        :disabled="yourTeam.length >= 5"
        title="Add to your team"
        @click="onPick($event, rec.hero.id)"
      >
        <UserPlus :size="14" /><span>Pick</span>
      </button>
    </div>
  </section>
</template>
