<script setup lang="ts">
import type { Role } from "../api/types";
import { usePreferences } from "../composables/usePreferences";
import { usePatch } from "../composables/usePatch";

const ROLE_LABELS: Record<Role, string> = {
  carry: "Carry — Pos 1",
  mid: "Mid — Pos 2",
  offlane: "Offlane — Pos 3",
  support: "Support — Pos 4",
  "hard-support": "Hard Support — Pos 5",
};

const { theme, defaultRole, showMatchupVisuals, compactRecommendations, toggleTheme } =
  usePreferences();
const { patch } = usePatch();
</script>
<template>
  <div class="standard-page settings">
    <div class="page-head">
      <div>
        <h1>Settings</h1>
        <p>Customize your draft room preferences.</p>
      </div>
    </div>
    <section class="panel">
      <h2>Draft preferences</h2>
      <label
        >Default role
        <select v-model="defaultRole" class="filter-select">
          <option v-for="(label, value) in ROLE_LABELS" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </label>
      <label
        >Current patch <span class="static-value">{{ patch || "Loading…" }}</span></label
      >
    </section>
    <section class="panel">
      <h2>Display preferences</h2>
      <label
        >Theme
        <button type="button" @click="toggleTheme">
          {{ theme === "dark" ? "Dark esports" : "Light" }}
        </button>
      </label>
      <label class="toggle" @click="showMatchupVisuals = !showMatchupVisuals"
        >Show matchup visuals <i :class="{ off: !showMatchupVisuals }"></i
      ></label>
      <label class="toggle" @click="compactRecommendations = !compactRecommendations"
        >Compact recommendation list <i :class="{ off: !compactRecommendations }"></i
      ></label>
    </section>
  </div>
</template>
