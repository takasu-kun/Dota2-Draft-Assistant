<script setup lang="ts">
// Fills with currentColor so callers control the color via CSS (kept a
// consistent brand red in both themes here) - the cut-out "cleft" is a true
// transparent hole (evenodd fill-rule), not a color trick, so it always
// shows whatever is actually behind it: dark background in dark mode,
// light background in light mode, no per-theme styling needed for it.
withDefaults(defineProps<{ size?: number }>(), { size: 40 });
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    class="dota-logo"
  >
    <path
      fill="currentColor"
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M6,6 L94,6 L94,94 L6,94 Z M8,66 L66,8 L92,34 L34,92 Z M64,6 L94,6 L94,36 Z"
    />
  </svg>
</template>
