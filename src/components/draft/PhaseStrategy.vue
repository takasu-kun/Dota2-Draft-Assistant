<script setup lang="ts">
import { ref, computed } from "vue";
import { ArrowUp, ArrowDown, Minus } from "lucide-vue-next";
import type { AdvancedInsights, GamePhase, PhaseComparison } from "../../api/types";

const props = defineProps<{ insights: AdvancedInsights }>();

const PHASES: GamePhase[] = ["early", "mid", "late"];
const activePhase = ref<GamePhase>("early");

const current = computed<PhaseComparison>(() => props.insights[activePhase.value]);

const advantageCopy = computed(() => {
  const a = current.value.advantage;
  if (a === "your") return { label: "Your Team Advantage", tone: "your" };
  if (a === "enemy") return { label: "Enemy Advantage", tone: "enemy" };
  return { label: "Even", tone: "even" };
});

const POWER_WINDOW_PCT: Record<string, number> = { Strong: 85, Moderate: 55, Weak: 25 };
</script>
<template>
  <section class="phase-strategy">
    <header class="phase-strategy-head">
      <b>How should this draft be played?</b>
      <small>A strategic timeline derived from the drafted heroes, not a guaranteed outcome.</small>
    </header>
    <div class="phase-tabs" role="tablist">
      <button
        v-for="phase in PHASES"
        :key="phase"
        type="button"
        role="tab"
        :class="{ active: activePhase === phase }"
        @click="activePhase = phase"
      >
        <b>{{ insights[phase].label }}</b>
        <small>{{ insights[phase].window }}</small>
      </button>
    </div>

    <div class="phase-panel">
      <div class="phase-advantage" :class="advantageCopy.tone">
        <ArrowUp v-if="advantageCopy.tone === 'your'" :size="16" />
        <ArrowDown v-else-if="advantageCopy.tone === 'enemy'" :size="16" />
        <Minus v-else :size="16" />
        <div>
          <b>{{ advantageCopy.label }}</b>
          <p>{{ current.reason }}</p>
        </div>
      </div>
      <p v-if="current.confidence === 'low'" class="phase-low-confidence">
        Limited data is available for this phase - treat this as a rough lean, and revisit as more
        heroes are picked.
      </p>

      <div class="phase-teams">
        <article class="phase-team-col">
          <header>
            <b>Your Team</b>
            <span class="power-window" :class="current.yourTeam.powerWindow.toLowerCase()">
              <i :style="{ width: POWER_WINDOW_PCT[current.yourTeam.powerWindow] + '%' }"></i>
            </span>
            <small>{{ current.yourTeam.powerWindow }}</small>
          </header>
          <p class="game-plan">{{ current.yourTeam.gamePlan }}</p>
          <div class="phase-list">
            <b>Priorities</b>
            <ul>
              <li v-for="p in current.yourTeam.priorities" :key="p">{{ p }}</li>
            </ul>
          </div>
          <div class="phase-list avoid">
            <b>Avoid</b>
            <ul>
              <li v-for="a in current.yourTeam.avoid" :key="a">{{ a }}</li>
            </ul>
          </div>
        </article>

        <article class="phase-team-col enemy">
          <header>
            <b>Enemy Team</b>
            <span class="power-window" :class="current.enemyTeam.powerWindow.toLowerCase()">
              <i :style="{ width: POWER_WINDOW_PCT[current.enemyTeam.powerWindow] + '%' }"></i>
            </span>
            <small>{{ current.enemyTeam.powerWindow }}</small>
          </header>
          <p class="game-plan">{{ current.enemyTeam.gamePlan }}</p>
          <div class="phase-list">
            <b>Priorities</b>
            <ul>
              <li v-for="p in current.enemyTeam.priorities" :key="p">{{ p }}</li>
            </ul>
          </div>
          <div class="phase-list avoid">
            <b>Avoid</b>
            <ul>
              <li v-for="a in current.enemyTeam.avoid" :key="a">{{ a }}</li>
            </ul>
          </div>
        </article>
      </div>
    </div>

    <div class="win-conditions">
      <div>
        <b>Your Win Condition</b>
        <p>{{ insights.yourWinCondition }}</p>
      </div>
      <div>
        <b>Enemy Win Condition</b>
        <p>{{ insights.enemyWinCondition }}</p>
      </div>
    </div>
  </section>
</template>
