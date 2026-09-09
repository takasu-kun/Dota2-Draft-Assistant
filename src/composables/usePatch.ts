import { ref } from "vue";
import { getMeta } from "../api/meta";

const patch = ref<string>("");
const loading = ref(false);
let loaded = false;

async function load(): Promise<void> {
  if (loaded || loading.value) return;
  loading.value = true;
  try {
    patch.value = (await getMeta()).patch;
    loaded = true;
  } catch {
    patch.value = "";
  } finally {
    loading.value = false;
  }
}

export function usePatch() {
  if (!loaded) void load();
  return { patch, loading };
}
