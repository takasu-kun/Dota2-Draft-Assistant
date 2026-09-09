<script setup lang="ts">
import AppSidebar from "./components/layout/AppSidebar.vue";
import AppTopbar from "./components/layout/AppTopbar.vue";
</script>
<template>
  <div class="app-shell">
    <AppTopbar /><AppSidebar />
    <main class="content"><RouterView /></main>
  </div>
</template>
