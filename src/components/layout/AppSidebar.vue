<script setup lang="ts">
import { Rocket, Globe2, History, Wrench, BarChart3 } from "lucide-vue-next";
const links = [
  { to: "/", label: "Draft Assistant", icon: Rocket },
  { to: "/heroes", label: "Hero Explorer", icon: Globe2 },
  { to: "/matches", label: "Hero Matches", icon: History },
  { to: "/builds", label: "Hero Builds", icon: Wrench },
  { to: "/meta", label: "Meta Insights", icon: BarChart3 },
];
</script>
<template>
  <aside class="sidebar">
    <nav>
      <RouterLink v-for="link in links" :key="link.to" :to="link.to" v-slot="{ isActive }"
        ><div :class="['nav-link', { active: isActive }]">
          <component :is="link.icon" :size="21" /><span>{{ link.label }}</span>
        </div></RouterLink
      >
    </nav>
    <div class="side-promo">
      <div class="dota-watermark">◢</div>
      <b>Better Drafts<br />Brighter Wins</b>
      <p>Analyze. Adapt. Dominate.</p>
    </div>
  </aside>
</template>
