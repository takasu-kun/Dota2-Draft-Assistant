import { ref, watch } from "vue";
import type { Role } from "../api/types";

const STORAGE_KEY = "dota-draft-assistant:preferences";

interface Preferences {
  theme: "dark" | "light";
  defaultRole: Role;
  showMatchupVisuals: boolean;
  compactRecommendations: boolean;
}

const DEFAULTS: Preferences = {
  theme: "dark",
  defaultRole: "support",
  showMatchupVisuals: true,
  compactRecommendations: false,
};

function loadStored(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return { ...DEFAULTS };
  }
}

const stored = loadStored();
const theme = ref<Preferences["theme"]>(stored.theme);
const defaultRole = ref<Preferences["defaultRole"]>(stored.defaultRole);
const showMatchupVisuals = ref(stored.showMatchupVisuals);
const compactRecommendations = ref(stored.compactRecommendations);

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: theme.value,
        defaultRole: defaultRole.value,
        showMatchupVisuals: showMatchupVisuals.value,
        compactRecommendations: compactRecommendations.value,
      } satisfies Preferences),
    );
  } catch {
    // localStorage unavailable (private browsing, etc.) - preferences just won't persist.
  }
}

function applyTheme() {
  document.documentElement.dataset.theme = theme.value;
}
applyTheme();

watch([theme, defaultRole, showMatchupVisuals, compactRecommendations], () => {
  persist();
  applyTheme();
});

export function usePreferences() {
  return {
    theme,
    defaultRole,
    showMatchupVisuals,
    compactRecommendations,
    toggleTheme: () => (theme.value = theme.value === "dark" ? "light" : "dark"),
  };
}
