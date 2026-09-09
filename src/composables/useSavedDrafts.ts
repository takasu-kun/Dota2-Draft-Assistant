import { ref } from "vue";
import type { Role } from "../api/types";

const STORAGE_KEY = "dota-draft-assistant:saved-drafts";

export interface SavedDraft {
  id: string;
  title: string;
  createdAt: string; // ISO timestamp
  score: number;
  role: Role;
  yourTeam: number[];
  enemyTeam: number[];
  /** Precomputed for display so the list doesn't need the hero catalog loaded. */
  yourTeamNames: string[];
  enemyTeamNames: string[];
}

function loadStored(): SavedDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedDraft[]) : [];
  } catch {
    return [];
  }
}

const drafts = ref<SavedDraft[]>(loadStored());

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.value));
  } catch {
    // localStorage unavailable - saves just won't persist across reloads.
  }
}

export function useSavedDrafts() {
  function save(entry: Omit<SavedDraft, "id" | "createdAt">): SavedDraft {
    const saved: SavedDraft = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    drafts.value = [saved, ...drafts.value];
    persist();
    return saved;
  }
  function remove(id: string) {
    drafts.value = drafts.value.filter((d) => d.id !== id);
    persist();
  }
  return { drafts, save, remove };
}
