<script setup lang="ts">
import { Check } from "lucide-vue-next";
import type { Role } from "../../api/types";
import { useDraftState } from "../../composables/useDraftState";
import { ROLE_LABELS, ROLE_POSITIONS } from "../../constants/roles";

const roles = Object.keys(ROLE_LABELS) as Role[];

const {
  role,
  setRole,
  analyze,
  analyzing,
  canAnalyze,
  analysisError,
  yourTeam,
  enemyTeam,
  isRoleTaken,
} = useDraftState();
</script>
<template>
  <section class="role-section">
    <label><b>Your Role</b> (for next pick)</label>
    <div class="role-row">
      <button
        v-for="value in roles"
        :key="value"
        type="button"
        :class="{ selected: role === value, taken: isRoleTaken(value) }"
        :title="
          isRoleTaken(value) ? `${ROLE_LABELS[value]} is already covered by another pick` : ''
        "
        @click="setRole(value)"
      >
        <Check v-if="isRoleTaken(value)" :size="12" class="taken-check" />
        <b>{{ ROLE_LABELS[value] }}</b>
        <small>{{ ROLE_POSITIONS[value] }}</small>
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
