import { computed, ref } from "vue";
import { getHeroes } from "../api/heroes";
import type { Hero } from "../api/types";

// Module-level (singleton) state: every component that imports this
// composable shares the same catalog instead of re-fetching it.
const heroes = ref<Hero[]>([]);
const loading = ref(false);
const error = ref("");
let loaded = false;
let inFlight: Promise<void> | null = null;

async function load(force = false): Promise<void> {
  if (loaded && !force) return;
  if (inFlight) return inFlight;
  loading.value = true;
  error.value = "";
  inFlight = getHeroes()
    .then((data) => {
      heroes.value = data;
      loaded = true;
    })
    .catch(() => {
      error.value = "Unable to load hero data.";
    })
    .finally(() => {
      loading.value = false;
      inFlight = null;
    });
  return inFlight;
}

const heroById = computed(() => new Map(heroes.value.map((h) => [h.id, h])));

// Decorative portrait color, derived from the hero id so it stays stable
// across re-sorts/filters instead of shifting with list position.
const TONES = [
  "amber",
  "ember",
  "ice",
  "violet",
  "azure",
  "teal",
  "crimson",
  "ochre",
  "moon",
  "magenta",
];
function heroTone(id: number): string {
  return TONES[id % TONES.length];
}

export function useHeroCatalog() {
  if (!loaded && !inFlight) void load();
  return { heroes, heroById, loading, error, reload: () => load(true), heroTone };
}
