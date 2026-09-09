<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { MoreHorizontal, Trash2 } from "lucide-vue-next";
import { useSavedDrafts } from "../composables/useSavedDrafts";
import { useDraftState } from "../composables/useDraftState";

const { drafts, remove } = useSavedDrafts();
const { reset, loadDraft } = useDraftState();
const router = useRouter();

const menuOpenId = ref<string | null>(null);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function openDraft(draft: (typeof drafts.value)[number]) {
  loadDraft(draft);
  router.push("/");
}
function newDraft() {
  reset();
  router.push("/");
}
</script>
<template>
  <div class="standard-page">
    <div class="page-head">
      <div>
        <h1>Saved Drafts</h1>
        <p>Return to your past lineups and draft reviews.</p>
      </div>
      <button type="button" class="share" @click="newDraft">New Draft</button>
    </div>
    <p v-if="!drafts.length" class="analysis-empty">
      No saved drafts yet. Analyze a draft and save it from the Draft Assistant.
    </p>
    <section v-else class="saved-list">
      <article v-for="d in drafts" :key="d.id">
        <button type="button" class="saved-row" @click="openDraft(d)">
          <div class="saved-score">{{ d.score }}<small>score</small></div>
          <div>
            <h2>{{ d.title }}</h2>
            <p>
              {{ d.yourTeamNames.join(", ") || "—" }} vs {{ d.enemyTeamNames.join(", ") || "—" }}
            </p>
            <small>{{ formatDate(d.createdAt) }}</small>
          </div>
        </button>
        <div class="saved-menu">
          <button
            type="button"
            class="icon-btn"
            @click.stop="menuOpenId = menuOpenId === d.id ? null : d.id"
          >
            <MoreHorizontal />
          </button>
          <button
            v-if="menuOpenId === d.id"
            type="button"
            class="saved-delete"
            @click.stop="remove(d.id)"
          >
            <Trash2 :size="14" /> Delete
          </button>
        </div>
      </article>
    </section>
  </div>
</template>
