<script setup lang="ts">
import { computed, ref } from "vue";
import { Plus, X } from "lucide-vue-next";
import { useHeroCatalog } from "../../composables/useHeroCatalog";
import { useDraftState } from "../../composables/useDraftState";
import { ROLE_LABELS } from "../../constants/roles";
import type { Hero } from "../../api/types";
import HeroPicker from "./HeroPicker.vue";
import HeroPortrait from "../HeroPortrait.vue";

const props = withDefaults(
  defineProps<{ hero?: Hero | null; enemy?: boolean; interactive?: boolean; exclude?: number[] }>(),
  { hero: null, interactive: true, exclude: () => [] },
);
const emit = defineEmits<{ pick: [heroId: number]; remove: [] }>();

const { heroTone } = useHeroCatalog();
const { getPickedRole } = useDraftState();
const pickerOpen = ref(false);

// The role you had selected in "Your Role" when you picked this hero takes
// priority over its generic role tag - it's what you actually drafted it
// for, not just a heuristic guess (see useDraftState.ts's pickedRoles).
const displayedRole = computed(() => {
  if (!props.hero) return "";
  const pickedRole = getPickedRole(props.hero.id);
  return pickedRole
    ? ROLE_LABELS[pickedRole]
    : (props.hero.roles[0] ?? props.hero.primaryAttribute);
});

function onSelect(heroId: number) {
  pickerOpen.value = false;
  emit("pick", heroId);
}
</script>
<template>
  <div v-if="hero" :class="['hero-slot', { enemy, filled: interactive }]">
    <button
      v-if="interactive"
      type="button"
      class="remove-hero"
      title="Remove hero"
      @click="emit('remove')"
    >
      <X :size="12" />
    </button>
    <div :class="['portrait', heroTone(hero.id)]">
      <HeroPortrait :name="hero.name" :image="hero.image" />
    </div>
    <b>{{ hero.name }}</b>
    <small>{{ displayedRole }}</small>
  </div>
  <div v-else-if="interactive" class="hero-slot empty" :class="{ enemy }">
    <button type="button" class="empty-slot-trigger" @click="pickerOpen = !pickerOpen">
      <Plus :size="21" /><small>Pick Hero</small>
    </button>
    <HeroPicker
      v-if="pickerOpen"
      :exclude="exclude"
      @select="onSelect"
      @close="pickerOpen = false"
    />
  </div>
  <div v-else :class="['hero-slot empty', { enemy }]"><small>Empty</small></div>
</template>
