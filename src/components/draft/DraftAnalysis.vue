<script setup lang="ts">
import { CheckCircle2, AlertTriangle, CirclePlus } from "lucide-vue-next";
import { useDraftState } from "../../composables/useDraftState";

const { analysis, analyzing } = useDraftState();
</script>
<template>
  <section class="analysis">
    <h2>Draft Analysis</h2>
    <p v-if="analyzing" class="analysis-empty">Analyzing draft…</p>
    <p v-else-if="!analysis" class="analysis-empty">
      Add heroes to both teams and click <b>Analyze Draft</b> to see insights.
    </p>
    <div v-else class="analysis-grid">
      <article class="insight good">
        <h3>◉ &nbsp; Team Strengths</h3>
        <p v-for="x in analysis.strengths" :key="x"><CheckCircle2 :size="18" />{{ x }}</p>
      </article>
      <article class="insight bad">
        <h3>✖ &nbsp; Team Weaknesses</h3>
        <p v-for="x in analysis.weaknesses" :key="x"><AlertTriangle :size="18" />{{ x }}</p>
      </article>
      <article class="insight priorities">
        <h3>◎ &nbsp; Key Priorities</h3>
        <p v-if="!analysis.priorities.length">No standout priorities identified.</p>
        <p v-for="x in analysis.priorities" :key="x.name">
          <CirclePlus :size="17" />{{ x.name }}<span :class="x.priority">{{ x.priority }}</span>
        </p>
      </article>
    </div>
  </section>
</template>
