<script setup lang="ts">
import { computed } from "vue";
import HeroSlot from "./HeroSlot.vue";
import DraftScore from "./DraftScore.vue";
import { useHeroCatalog } from "../../composables/useHeroCatalog";
import { useDraftState } from "../../composables/useDraftState";

const { heroById } = useHeroCatalog();
const { yourTeam, enemyTeam } = useDraftState();

const yourHeroes = computed(() =>
  yourTeam.value.map((id) => heroById.value.get(id)).filter(Boolean),
);
const enemyHeroes = computed(() =>
  enemyTeam.value.map((id) => heroById.value.get(id)).filter(Boolean),
);
</script>
<template>
  <section class="synergy">
    <h2>Draft Synergy Map</h2>
    <div class="synergy-inner">
      <div class="map-team teal-map">
        <b>Your Team</b>
        <div class="connections"></div>
        <div class="map-heroes">
          <p v-if="!yourHeroes.length" class="synergy-empty">No picks yet</p>
          <HeroSlot v-for="hero in yourHeroes" :key="hero!.id" :hero="hero" :interactive="false" />
        </div>
      </div>
      <DraftScore />
      <div class="map-team red-map">
        <b>Enemy Team</b>
        <div class="connections"></div>
        <div class="map-heroes">
          <p v-if="!enemyHeroes.length" class="synergy-empty">No picks yet</p>
          <HeroSlot
            v-for="hero in enemyHeroes"
            :key="hero!.id"
            :hero="hero"
            :interactive="false"
            enemy
          />
        </div>
      </div>
    </div>
  </section>
</template>
