<script setup lang="ts">
import { computed } from "vue";
import { useHeroCatalog } from "../../composables/useHeroCatalog";
import { useDraftState } from "../../composables/useDraftState";
import HeroPortrait from "../HeroPortrait.vue";

const { heroTone } = useHeroCatalog();
const { selectedRecommendation } = useDraftState();

const stats = computed(() => {
  const rec = selectedRecommendation.value;
  if (!rec) return [];
  return [
    ["Counter", rec.breakdown.counter],
    ["Synergy", rec.breakdown.synergy],
    ["Role Fit", rec.breakdown.roleFit],
    ["Meta", rec.breakdown.meta],
  ] as const;
});
</script>
<template>
  <section v-if="selectedRecommendation" class="rec-detail">
    <div class="detail-title">
      <div :class="['portrait', heroTone(selectedRecommendation.hero.id)]">
        <HeroPortrait
          :name="selectedRecommendation.hero.name"
          :image="selectedRecommendation.hero.image"
        />
      </div>
      <h2>Why {{ selectedRecommendation.hero.name }}?</h2>
      <div class="big-score">{{ selectedRecommendation.score }}<small>/ 100</small></div>
    </div>
    <div class="tags">
      <span v-if="!selectedRecommendation.reasons.length">Solid all-round pick</span>
      <span v-for="reason in selectedRecommendation.reasons.slice(0, 3)" :key="reason">{{
        reason
      }}</span>
    </div>
    <p>
      {{ selectedRecommendation.hero.name }} scores {{ selectedRecommendation.score }}/100 for this
      draft{{
        selectedRecommendation.reasons.length
          ? `, thanks to: ${selectedRecommendation.reasons.join("; ")}.`
          : "."
      }}
    </p>
    <b>Score Breakdown</b>
    <div class="breakdown">
      <label v-for="[name, value] in stats" :key="name"
        ><span>{{ name }}</span
        ><i><em :style="{ width: Math.min(100, value) + '%' }"></em></i
        ><strong>{{ Math.round(value) }}</strong></label
      >
    </div>
    <div v-if="selectedRecommendation.reasons[0]" class="pro-tip">
      <b>💡 &nbsp; Pro Tip</b>
      <p>{{ selectedRecommendation.reasons[0] }} - lean into this in lane and team fights.</p>
    </div>
  </section>
  <section v-else class="rec-detail empty">
    <p class="analysis-empty">Select a recommendation to see why it's suggested.</p>
  </section>
</template>
