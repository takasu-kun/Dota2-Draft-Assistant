<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Search } from "lucide-vue-next";
import { getHeroes } from "../api/heroes";
import type { Hero, Role } from "../api/types";
import { useHeroCatalog } from "../composables/useHeroCatalog";
import HeroPortrait from "../components/HeroPortrait.vue";

const route = useRoute();
const { heroTone } = useHeroCatalog();

const ROLE_OPTIONS: { value: Role | ""; label: string }[] = [
  { value: "", label: "All Roles" },
  { value: "carry", label: "Carry" },
  { value: "mid", label: "Mid" },
  { value: "offlane", label: "Offlane" },
  { value: "support", label: "Support" },
  { value: "hard-support", label: "Hard Support" },
];
const ATTRIBUTE_OPTIONS = [
  { value: "", label: "All Attributes" },
  { value: "strength", label: "Strength" },
  { value: "agility", label: "Agility" },
  { value: "intelligence", label: "Intelligence" },
  { value: "universal", label: "Universal" },
];

const heroes = ref<Hero[]>([]),
  search = ref(""),
  role = ref<Role | "">(""),
  attribute = ref(""),
  loading = ref(true),
  error = ref("");

async function load() {
  loading.value = true;
  error.value = "";
  try {
    heroes.value = await getHeroes({
      search: search.value || undefined,
      role: role.value || undefined,
      attribute: attribute.value || undefined,
    });
  } catch {
    error.value = "Unable to load heroes. Please try again.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const q = route.query.search;
  if (typeof q === "string") search.value = q;
  const r = route.query.role;
  if (typeof r === "string") role.value = r as Role;
  load();
});
watch([role, attribute], load);
</script>
<template>
  <div class="standard-page">
    <div class="page-head">
      <div>
        <h1>Hero Explorer</h1>
        <p>Explore the current hero pool, roles, and competitive trends.</p>
      </div>
    </div>
    <div class="explorer-tools">
      <label class="search"
        ><Search :size="18" /><input
          v-model="search"
          @keyup.enter="load"
          @change="load"
          placeholder="Search heroes..."
      /></label>
      <select v-model="attribute" class="filter-select">
        <option v-for="opt in ATTRIBUTE_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <select v-model="role" class="filter-select">
        <option v-for="opt in ROLE_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>
    <p v-if="error" class="api-error">{{ error }} <button @click="load">Retry</button></p>
    <p v-else-if="!loading && !heroes.length" class="analysis-empty">
      No heroes match these filters.
    </p>
    <section v-else class="hero-grid">
      <article v-if="loading" v-for="n in 12" :key="n" class="hero-card skeleton">
        <div></div>
      </article>
      <article v-else v-for="hero in heroes" :key="hero.id" class="hero-card">
        <div :class="['portrait', heroTone(hero.id)]">
          <HeroPortrait :name="hero.name" :image="hero.image" />
        </div>
        <div>
          <h3>{{ hero.name }}</h3>
          <small>{{ hero.primaryAttribute }}</small>
          <p>{{ hero.roles.join(", ") }}</p>
          <footer>
            <span
              >Win Rate <b>{{ hero.winRate?.toFixed(1) ?? "—" }}%</b></span
            ><span
              >Pick Rate <b>{{ hero.pickRate?.toFixed(1) ?? "—" }}%</b></span
            >
          </footer>
          <div class="hero-card-actions">
            <RouterLink :to="{ path: '/matches', query: { hero: hero.id } }"
              >View Matches</RouterLink
            >
            <RouterLink :to="{ path: '/builds', query: { hero: hero.id } }">View Builds</RouterLink>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
