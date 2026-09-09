import { ref, watch } from "vue";

const STORAGE_KEY = "dota-draft-assistant:theme";

function loadStoredTheme(): "dark" | "light" {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

const theme = ref<"dark" | "light">(loadStoredTheme());

function applyTheme() {
  document.documentElement.dataset.theme = theme.value;
}
applyTheme();

watch(theme, () => {
  try {
    localStorage.setItem(STORAGE_KEY, theme.value);
  } catch {
    // localStorage unavailable (private browsing, etc.) - the choice just won't persist.
  }
  applyTheme();
});

export function usePreferences() {
  return {
    theme,
    toggleTheme: () => (theme.value = theme.value === "dark" ? "light" : "dark"),
  };
}
