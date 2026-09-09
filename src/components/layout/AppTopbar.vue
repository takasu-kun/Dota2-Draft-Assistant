<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { Search, ChevronDown, Sun, Moon } from "lucide-vue-next";
import { usePatch } from "../../composables/usePatch";
import { usePreferences } from "../../composables/usePreferences";
import DotaLogo from "../DotaLogo.vue";

const router = useRouter();
const { patch } = usePatch();
const { theme, toggleTheme } = usePreferences();
const search = ref("");

function onSearch() {
  if (!search.value.trim()) return;
  router.push({ path: "/heroes", query: { search: search.value.trim() } });
}
</script>
<template>
  <header class="topbar">
    <div class="brand">
      <div class="dota-mark"><DotaLogo :size="24" /></div>
      <div><b>Dota 2</b><strong>Draft Assistant</strong></div>
      <span>BETA</span>
    </div>
    <div class="top-tools">
      <label class="search"
        ><Search :size="19" /><input
          v-model="search"
          @keyup.enter="onSearch"
          placeholder="Search heroes, e.g. 'Invoker'..."
      /></label>
      <button type="button" class="patch-display">
        Patch {{ patch || "…" }} <ChevronDown :size="16" />
      </button>
      <button type="button" class="icon-btn theme-toggle" title="Toggle theme" @click="toggleTheme">
        <Moon v-if="theme === 'dark'" :size="22" class="sun" /><Sun v-else :size="22" class="sun" />
      </button>
      <a class="opendota-credit" href="https://www.opendota.com" target="_blank" rel="noopener">
        Powered by OpenDota
      </a>
    </div>
  </header>
</template>
