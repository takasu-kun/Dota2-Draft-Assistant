<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { Search, X } from "lucide-vue-next";
import { useHeroCatalog } from "../../composables/useHeroCatalog";

const props = defineProps<{ exclude: number[] }>();
const emit = defineEmits<{ select: [heroId: number]; close: [] }>();

const { heroes, loading } = useHeroCatalog();
const search = ref("");
const root = ref<HTMLElement | null>(null);

// No cap: every hero not already picked should be selectable here, not just
// the first N (the list scrolls within a fixed-height popover - see CSS).
const results = computed(() => {
  const excluded = new Set(props.exclude);
  const q = search.value.trim().toLowerCase();
  return heroes.value
    .filter((h) => !excluded.has(h.id))
    .filter((h) => !q || h.name.toLowerCase().includes(q) || h.shortName.toLowerCase().includes(q));
});

function onClickOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) emit("close");
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") emit("close");
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
  <div ref="root" class="hero-picker" @mousedown.stop>
    <header>
      <label
        ><Search :size="14" /><input v-model="search" autofocus placeholder="Search heroes..."
      /></label>
      <button class="picker-close" @click="emit('close')"><X :size="14" /></button>
    </header>
    <p v-if="loading" class="picker-empty">Loading heroes…</p>
    <p v-else-if="!results.length" class="picker-empty">No heroes match.</p>
    <ul v-else>
      <li v-for="hero in results" :key="hero.id">
        <button type="button" @click="emit('select', hero.id)">
          <span>{{ hero.name }}</span
          ><small>{{ hero.primaryAttribute }}</small>
        </button>
      </li>
    </ul>
  </div>
</template>
