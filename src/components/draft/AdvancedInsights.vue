<script setup lang="ts">
import { computed } from "vue";
import { Check, X } from "lucide-vue-next";
import type { Role } from "../../api/types";
import { useDraftState } from "../../composables/useDraftState";
import { useHeroCatalog } from "../../composables/useHeroCatalog";
import { ROLE_LABELS, ROLE_STRATEGY_TIPS } from "../../constants/roles";

const ROLES = Object.keys(ROLE_LABELS) as Role[];

const { analysis, yourTeam, enemyTeam, getPickedRole } = useDraftState();
const { heroById } = useHeroCatalog();

// Reverse-lookup: which hero (if any) was picked under each of the 5 roles,
// so the breakdown below can show "filled" vs. "open" per role regardless
// of whichever role happens to be selected in the picker right now.
const roleFill = computed(() => {
  const byRole = new Map<Role, number>();
  for (const heroId of yourTeam.value) {
    const r = getPickedRole(heroId);
    if (r) byRole.set(r, heroId);
  }
  return ROLES.map((r) => ({
    role: r,
    label: ROLE_LABELS[r],
    hero: byRole.has(r) ? (heroById.value.get(byRole.get(r)!) ?? null) : null,
  }));
});

const openRoleCount = computed(() => roleFill.value.filter((r) => !r.hero).length);

const scoreTier = computed(() => {
  const score = analysis.value?.draftScore ?? 0;
  if (score >= 80) return { label: "Excellent", tone: "great" };
  if (score >= 65) return { label: "Strong", tone: "good" };
  if (score >= 50) return { label: "Balanced", tone: "ok" };
  if (score >= 35) return { label: "Shaky", tone: "weak" };
  return { label: "Weak", tone: "bad" };
});

const summary = computed(() => {
  if (!analysis.value) return "";
  const { draftScore, strengths, weaknesses } = analysis.value;
  const parts: string[] = [];
  parts.push(
    `Overall this draft rates ${draftScore}/100 - ${scoreTier.value.label.toLowerCase()} - across ${yourTeam.value.length} of your picks against ${enemyTeam.value.length} enemy picks.`,
  );
  if (strengths.length && weaknesses.length) {
    parts.push(
      `It leans on ${strengths.length} identified strength${strengths.length === 1 ? "" : "s"} while carrying ${weaknesses.length} weakness${weaknesses.length === 1 ? "" : "es"} the enemy can play toward.`,
    );
  } else if (strengths.length) {
    parts.push(
      `No clear weaknesses stand out yet, but keep an eye on the enemy's remaining picks.`,
    );
  } else if (weaknesses.length) {
    parts.push(
      `It doesn't have a standout strength yet - look to your remaining picks to create one.`,
    );
  }
  if (openRoleCount.value > 0) {
    parts.push(
      `${openRoleCount.value} of 5 roles ${openRoleCount.value === 1 ? "is" : "are"} still open on your team - see the breakdown below for what to prioritize.`,
    );
  } else {
    parts.push(`All 5 roles are filled on your team.`);
  }
  return parts.join(" ");
});
</script>
<template>
  <p v-if="!analysis">Analyze your draft first to unlock detailed insights.</p>
  <template v-else>
    <p class="insights-summary">{{ summary }}</p>
    <div class="role-fill-grid">
      <div v-for="r in roleFill" :key="r.role" :class="['role-fill', r.hero ? 'filled' : 'open']">
        <div class="role-fill-head">
          <Check v-if="r.hero" :size="14" />
          <X v-else :size="14" />
          <b>{{ r.label }}</b>
          <span v-if="r.hero" class="role-fill-hero">{{ r.hero.name }}</span>
          <span v-else class="role-fill-hero">Open</span>
        </div>
        <p v-if="!r.hero" class="role-fill-tip">{{ ROLE_STRATEGY_TIPS[r.role] }}</p>
      </div>
    </div>
  </template>
</template>
