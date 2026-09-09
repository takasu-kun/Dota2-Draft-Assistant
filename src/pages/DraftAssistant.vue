<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { RotateCcw, Share2, ChevronDown } from "lucide-vue-next";
import DraftTeamCard from "../components/draft/DraftTeamCard.vue";
import RoleSelector from "../components/draft/RoleSelector.vue";
import DraftAnalysis from "../components/draft/DraftAnalysis.vue";
import SynergyMap from "../components/draft/SynergyMap.vue";
import RecommendationList from "../components/recommendations/RecommendationList.vue";
import RecommendationDetail from "../components/recommendations/RecommendationDetail.vue";
import Modal from "../components/Modal.vue";
import { useDraftState } from "../composables/useDraftState";
import { ROLE_LABELS } from "../constants/roles";

const route = useRoute();
const {
  yourTeam,
  enemyTeam,
  role,
  analysis,
  roleConflict,
  dismissRoleConflict,
  reset,
  shareUrl,
  hydrateFromQuery,
} = useDraftState();

const shareCopied = ref(false);
const advancedOpen = ref(false);

onMounted(() => hydrateFromQuery(route.query as Record<string, string | null>));

async function onShare() {
  const url = shareUrl();
  try {
    await navigator.clipboard.writeText(url);
    shareCopied.value = true;
    setTimeout(() => (shareCopied.value = false), 2000);
  } catch {
    window.prompt("Copy this link to share your draft:", url);
  }
}
</script>
<template>
  <div class="dashboard">
    <div class="dashboard-main">
      <div class="page-head">
        <div>
          <h1>Current Draft</h1>
          <p>Select the heroes that have been picked and tell us what role you're drafting.</p>
        </div>
        <div>
          <button type="button" @click="reset"><RotateCcw :size="15" /> Reset</button>
          <button type="button" class="share" @click="onShare">
            <Share2 :size="15" /> {{ shareCopied ? "Link Copied!" : "Share Draft" }}
          </button>
        </div>
      </div>
      <div class="teams">
        <DraftTeamCard title="Your Team" side="your" />
        <DraftTeamCard title="Enemy Team" side="enemy" enemy />
      </div>
      <RoleSelector />
      <DraftAnalysis />
      <SynergyMap />
      <div class="advanced" :class="{ open: advancedOpen }" @click="advancedOpen = !advancedOpen">
        <span>✥</span>
        <div>
          <b>Advanced Insights</b>
          <small>See detailed matchup data, win rates, and meta trends.</small>
        </div>
        <ChevronDown :size="18" :class="{ flipped: advancedOpen }" />
      </div>
      <div v-if="advancedOpen" class="advanced-panel">
        <p v-if="!analysis">Analyze your draft first to unlock detailed insights.</p>
        <p v-else>
          Draft score <b>{{ analysis.draftScore }}/100</b> for a
          <b>{{ role }}</b>
          pick, based on {{ yourTeam.length }} of your heroes vs {{ enemyTeam.length }} enemy
          heroes.
        </p>
      </div>
    </div>
    <aside class="recommendations"><RecommendationList /><RecommendationDetail /></aside>

    <Modal v-if="roleConflict" class="role-conflict" @close="dismissRoleConflict">
      <h2>Role Already Selected</h2>
      <p>
        <b>{{ ROLE_LABELS[roleConflict] }}</b> is already selected. Please select another role.
      </p>
      <button type="button" class="share" @click="dismissRoleConflict">Got it</button>
    </Modal>
  </div>
</template>
