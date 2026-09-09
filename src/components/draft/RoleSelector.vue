<script setup lang="ts">
import type { Role } from "../../api/types";
import { useDraftState } from "../../composables/useDraftState";

const roles: [Role, string, string][] = [
  ["carry", "Carry", "Pos 1"],
  ["mid", "Mid", "Pos 2"],
  ["offlane", "Offlane", "Pos 3"],
  ["support", "Support", "Pos 4"],
  ["hard-support", "Hard Support", "Pos 5"],
];

const { role, setRole, analyze, analyzing, canAnalyze, analysisError, yourTeam, enemyTeam } =
  useDraftState();
</script>
<template>
  <section class="role-section">
    <label><b>Your Role</b> (for next pick)</label>
    <div class="role-row">
      <button
        v-for="[value, label, pos] in roles"
        :key="value"
        type="button"
        :class="{ selected: role === value }"
        @click="setRole(value)"
      >
        <b>{{ label }}</b
        ><small>{{ pos }}</small>
      </button>
      <button type="button" class="analyze" :disabled="!canAnalyze" @click="analyze">
        <template v-if="analyzing">Analyzing…</template>
        <template v-else>✦&nbsp; Analyze Draft</template>
      </button>
    </div>
    <p v-if="analysisError" class="api-error">{{ analysisError }}</p>
    <p v-else-if="!yourTeam.length || !enemyTeam.length" class="role-hint">
      Add at least one hero to each team to analyze the draft.
    </p>
  </section>
</template>
