import { createRouter, createWebHistory } from "vue-router";
import DraftAssistant from "../pages/DraftAssistant.vue";
import HeroExplorer from "../pages/HeroExplorer.vue";
import MetaInsights from "../pages/MetaInsights.vue";
export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: DraftAssistant },
    { path: "/heroes", component: HeroExplorer },
    { path: "/meta", component: MetaInsights },
  ],
});
