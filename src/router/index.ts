import { createRouter, createWebHistory } from "vue-router";
import DraftAssistant from "../pages/DraftAssistant.vue";
import HeroExplorer from "../pages/HeroExplorer.vue";
import MetaInsights from "../pages/MetaInsights.vue";
import SavedDrafts from "../pages/SavedDrafts.vue";
import Settings from "../pages/Settings.vue";
export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: DraftAssistant },
    { path: "/heroes", component: HeroExplorer },
    { path: "/meta", component: MetaInsights },
    { path: "/saved", component: SavedDrafts },
    { path: "/settings", component: Settings },
  ],
});
