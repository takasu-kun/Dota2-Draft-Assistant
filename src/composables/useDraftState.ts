import { computed, ref } from "vue";
import { analyzeDraft } from "../api/draft";
import type { DraftAnalysis, Role } from "../api/types";

const MAX_TEAM_SIZE = 5;
const DEFAULT_ROLE: Role = "carry";

const role = ref<Role>(DEFAULT_ROLE);
const yourTeam = ref<number[]>([]);
const enemyTeam = ref<number[]>([]);
// The role that was selected in "Your Role (for next pick)" at the moment
// each of *your* heroes was picked - shown on that hero's slot instead of a
// generic role guess. Only tracked for your team: "your role" describes
// your own next pick, not the enemy's, so enemy slots always show the
// hero's usual role instead.
const pickedRoles = ref(new Map<number, Role>());
// Set when a pick is blocked because "Your Role" is already assigned to
// another hero on your team - a real team only has one hero per position.
// The UI shows this as a modal and clears it on dismiss.
const roleConflict = ref<Role | null>(null);
const analysis = ref<DraftAnalysis | null>(null);
const analyzing = ref(false);
const analysisError = ref("");
const selectedRecommendationIndex = ref(0);

const canAnalyze = computed(
  () => yourTeam.value.length > 0 && enemyTeam.value.length > 0 && !analyzing.value,
);
const selectedRecommendation = computed(
  () => analysis.value?.recommendations[selectedRecommendationIndex.value] ?? null,
);

function teamRef(side: "your" | "enemy") {
  return side === "your" ? yourTeam : enemyTeam;
}

/** Whether some *other* hero on your team is already assigned to this role. */
function isRoleTaken(r: Role): boolean {
  return [...pickedRoles.value.values()].includes(r);
}

function pickHero(side: "your" | "enemy", heroId: number) {
  const team = teamRef(side);
  const alreadyPicked = yourTeam.value.includes(heroId) || enemyTeam.value.includes(heroId);
  if (alreadyPicked || team.value.length >= MAX_TEAM_SIZE) return;
  if (side === "your" && isRoleTaken(role.value)) {
    roleConflict.value = role.value;
    return;
  }
  team.value = [...team.value, heroId];
  if (side === "your") pickedRoles.value.set(heroId, role.value);
}

function dismissRoleConflict() {
  roleConflict.value = null;
}

function removeHero(side: "your" | "enemy", heroId: number) {
  const team = teamRef(side);
  team.value = team.value.filter((id) => id !== heroId);
  pickedRoles.value.delete(heroId);
}

/** The role selected in "Your Role" when this hero was picked, if any (see `pickedRoles` above). */
function getPickedRole(heroId: number): Role | null {
  return pickedRoles.value.get(heroId) ?? null;
}

function reset() {
  yourTeam.value = [];
  enemyTeam.value = [];
  pickedRoles.value.clear();
  roleConflict.value = null;
  analysis.value = null;
  analysisError.value = "";
  selectedRecommendationIndex.value = 0;
}

async function analyze() {
  if (!canAnalyze.value) return;
  analyzing.value = true;
  analysisError.value = "";
  try {
    analysis.value = await analyzeDraft({
      yourTeam: yourTeam.value,
      enemyTeam: enemyTeam.value,
      role: role.value,
    });
    selectedRecommendationIndex.value = 0;
  } catch {
    analysisError.value = "Unable to analyze this draft. Please try again.";
  } finally {
    analyzing.value = false;
  }
}

/** Builds a shareable link encoding the current draft (heroes + role) as query params. */
function shareUrl(): string {
  const params = new URLSearchParams();
  if (yourTeam.value.length) params.set("your", yourTeam.value.join(","));
  if (enemyTeam.value.length) params.set("enemy", enemyTeam.value.join(","));
  params.set("role", role.value);
  return `${location.origin}${location.pathname}?${params.toString()}`;
}

function parseIds(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_TEAM_SIZE);
}

/** Hydrates state from a shared link's query params (only if the draft is currently empty). */
function hydrateFromQuery(query: Record<string, string | null | (string | null)[]>) {
  if (yourTeam.value.length || enemyTeam.value.length) return;
  const get = (key: string) => {
    const v = query[key];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
  const your = parseIds(get("your"));
  const enemy = parseIds(get("enemy"));
  const queryRole = get("role");
  if (your.length) yourTeam.value = your;
  if (enemy.length) enemyTeam.value = enemy;
  if (queryRole && isRole(queryRole)) role.value = queryRole;
}

function isRole(value: string): value is Role {
  return (["carry", "mid", "offlane", "support", "hard-support"] satisfies Role[]).includes(
    value as Role,
  );
}

export function useDraftState() {
  return {
    role,
    yourTeam,
    enemyTeam,
    analysis,
    analyzing,
    analysisError,
    canAnalyze,
    selectedRecommendationIndex,
    selectedRecommendation,
    getPickedRole,
    isRoleTaken,
    roleConflict,
    dismissRoleConflict,
    setRole: (r: Role) => (role.value = r),
    pickHero,
    removeHero,
    reset,
    analyze,
    shareUrl,
    hydrateFromQuery,
    maxTeamSize: MAX_TEAM_SIZE,
  };
}
