<script setup lang="ts">
import { computed } from "vue";
import { Shield } from "lucide-vue-next";
import HeroSlot from "./HeroSlot.vue";
import { useHeroCatalog } from "../../composables/useHeroCatalog";
import { useDraftState } from "../../composables/useDraftState";

const props = defineProps<{ title: string; side: "your" | "enemy"; enemy?: boolean }>();

const { heroById } = useHeroCatalog();
const { yourTeam, enemyTeam, pickHero, removeHero, maxTeamSize } = useDraftState();

const teamIds = computed(() => (props.side === "your" ? yourTeam.value : enemyTeam.value));
const otherTeamIds = computed(() => (props.side === "your" ? enemyTeam.value : yourTeam.value));
const slots = computed(() =>
  Array.from({ length: maxTeamSize }, (_, i) => teamIds.value[i] ?? null),
);
</script>
<template>
  <section :class="['team-card', { enemy }]">
    <header>
      <span><Shield :size="20" fill="currentColor" /> {{ title }}</span
      ><em>{{ teamIds.length }} / {{ maxTeamSize }} picks</em>
    </header>
    <div class="slots">
      <HeroSlot
        v-for="(heroId, i) in slots"
        :key="heroId ?? `empty-${i}`"
        :hero="heroId ? (heroById.get(heroId) ?? null) : null"
        :enemy="enemy"
        :exclude="[...teamIds, ...otherTeamIds]"
        @pick="(id) => pickHero(side, id)"
        @remove="() => heroId && removeHero(side, heroId)"
      />
    </div>
  </section>
</template>
