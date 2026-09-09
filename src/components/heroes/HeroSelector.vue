<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ChevronDown, Search } from "lucide-vue-next";
import { useHeroCatalog } from "../../composables/useHeroCatalog";
import HeroPortrait from "../HeroPortrait.vue";

const modelValue = defineModel<number | null>({ default: null });

const { heroes, heroById, heroTone, loading } = useHeroCatalog();
const search = ref("");
const open = ref(false);
const root = ref<HTMLElement | null>(null);

const selectedHero = computed(() =>
  modelValue.value ? (heroById.value.get(modelValue.value) ?? null) : null,
);
const results = computed(() => {
  const q = search.value.trim().toLowerCase();
  return heroes.value
    .filter((h) => !q || h.name.toLowerCase().includes(q) || h.shortName.toLowerCase().includes(q))
    .slice(0, 40);
});

function select(heroId: number) {
  modelValue.value = heroId;
  open.value = false;
  search.value = "";
}
function onClickOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false;
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") open.value = false;
}
onMounted(() => {
  document.addEventListener("mousedown", onClickOutside);
  document.addEventListener("keydown", onKeydown);
});
onUnmounted(() => {
  document.removeEventListener("mousedown", onClickOutside);
  document.removeEventListener("keydown", onKeydown);
});
</script>
<template>
  <div ref="root" class="hero-selector">
    <button type="button" class="hero-selector-trigger" @click="open = !open">
      <template v-if="selectedHero">
        <div :class="['portrait', heroTone(selectedHero.id)]">
          <HeroPortrait :name="selectedHero.name" :image="selectedHero.image" />
        </div>
        <span>{{ selectedHero.name }}</span>
      </template>
      <span v-else class="placeholder">Select Hero</span>
      <ChevronDown :size="16" />
    </button>
    <div v-if="open" class="hero-picker hero-selector-dropdown" @mousedown.stop>
      <header>
        <label
          ><Search :size="14" /><input v-model="search" autofocus placeholder="Search heroes..."
        /></label>
      </header>
      <p v-if="loading" class="picker-empty">Loading heroes…</p>
      <p v-else-if="!results.length" class="picker-empty">No heroes match.</p>
      <ul v-else>
        <li v-for="hero in results" :key="hero.id">
          <button type="button" @click="select(hero.id)">
            <span>{{ hero.name }}</span
            ><small>{{ hero.primaryAttribute }}</small>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
