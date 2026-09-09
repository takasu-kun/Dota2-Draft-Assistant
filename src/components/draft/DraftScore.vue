<script setup lang="ts">
import { computed } from "vue";
import { useDraftState } from "../../composables/useDraftState";

const { analysis } = useDraftState();
const score = computed(() => analysis.value?.draftScore ?? null);
const label = computed(() => {
  const s = score.value;
  if (s === null) return "Not analyzed yet";
  if (s >= 75) return "Strong draft";
  if (s >= 55) return "Decent foundation";
  if (s >= 40) return "Needs work";
  return "Weak draft";
});
const hint = computed(() => {
  const s = score.value;
  if (s === null) return "Analyze your draft to see a score.";
  if (s >= 75) return "Your lineup covers its bases well.";
  if (s >= 55) return "Fill the gaps with control and late-game.";
  return "Look for counters and synergy picks.";
});
</script>
<template>
  <div class="draft-score">
    <small>Overall Draft Score</small>
    <div class="score-ring">
      <b>{{ score ?? "—" }}</b
      ><span>/ 100</span>
    </div>
    <b>{{ label }}</b>
    <p>{{ hint }}</p>
  </div>
</template>
