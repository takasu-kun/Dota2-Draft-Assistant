<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { X } from "lucide-vue-next";

// Disabled so a class passed to <Modal> lands on .modal-panel (the box
// callers actually want to size/style), not on the full-screen backdrop.
defineOptions({ inheritAttrs: false });
const emit = defineEmits<{ close: [] }>();

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") emit("close");
}
onMounted(() => {
  document.addEventListener("keydown", onKeydown);
  document.body.style.overflow = "hidden";
});
onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>
<template>
  <div class="modal-backdrop" @mousedown.self="emit('close')">
    <div class="modal-panel" v-bind="$attrs">
      <button type="button" class="modal-close" title="Close" @click="emit('close')">
        <X :size="16" />
      </button>
      <slot />
    </div>
  </div>
</template>
