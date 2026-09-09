<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ name: string; image: string | null }>();
const failed = ref(false);
watch(
  () => props.image,
  () => (failed.value = false),
);

function initials(name: string) {
  return name
    .split(" ")
    .map((x) => x[0])
    .join("");
}
</script>
<template>
  <!-- Initials render first as a base layer so something is always visible
       while the portrait image is loading, or if it fails to load. -->
  <i>{{ initials(name) }}</i>
  <img v-if="image && !failed" :src="image" :alt="name" @error="failed = true" />
</template>
