import type {
  AdvancedInsights,
  GamePhase,
  Hero,
  InsightConfidence,
  PhaseAdvantage,
  PhaseComparison,
  PhaseTeamStrategy,
  PowerWindow,
} from "../types/domain.js";

/**
 * Advanced Insights: "how should each team play this draft across the game?"
 *
 * This is a deterministic heuristic model, not a prediction engine. It is
 * built entirely from real, already-fetched data - OpenDota's own hero role
 * tags (see heroService.ts's `getRawRoleTags`, sourced from `GET
 * /heroStats`'s `roles` field) - mapped through a hand-written, centralized
 * weight table into eight strategic "dimensions" (laning, teamfight,
 * pickoff, push, scaling, farming, catch, sustain). Those dimensions are
 * then blended into three game-phase scores (early/mid/late) using a
 * second, equally centralized weight table.
 *
 * Nothing here fabricates a statistic OpenDota doesn't provide (no invented
 * timings, GPM, or phase-specific win rates) - every number traces back to a
 * hero's real role tags, and every weight below is a documented, adjustable
 * constant rather than a scattered magic number. Compare to
 * roleFitService.ts's FALLBACK_ROLE_TAGS table, which takes the same
 * approach for a different purpose.
 */

type Dimension =
  "laning" | "teamfight" | "pickoff" | "push" | "scaling" | "farming" | "catch" | "sustain";

const ALL_DIMENSIONS: Dimension[] = [
  "laning",
  "teamfight",
  "pickoff",
  "push",
  "scaling",
  "farming",
  "catch",
  "sustain",
];

/**
 * How much each of OpenDota's real hero role tags contributes to each
 * strategic dimension. Purely a hand-authored heuristic mapping (like
 * heroService.ts's LANE_ROLE_HEURISTIC) - not derived from a formula, and
 * intentionally documented as such rather than presented as measured data.
 */
const TAG_DIMENSION_WEIGHTS: Record<string, Partial<Record<Dimension, number>>> = {
  Carry: { scaling: 2, farming: 1 },
  Escape: { catch: 1 },
  Jungler: { farming: 2 },
  Pusher: { push: 2, laning: 1 },
  Nuker: { pickoff: 2, teamfight: 1, laning: 1 },
  Initiator: { teamfight: 2, pickoff: 1 },
  Durable: { sustain: 2, teamfight: 1, scaling: 1 },
  Disabler: { teamfight: 2, pickoff: 1, laning: 1 },
  Support: { sustain: 2, laning: 1 },
};

// A hero contributing about this many raw weight points to a dimension
// (e.g. Disabler + Initiator both landing on "teamfight") reads as a strong
// composition lean; used only to spread average per-hero contribution
// across the 0-100 display range, not as an official statistic.
const DIMENSION_NORMALIZATION_REFERENCE = 3;

export type DimensionScores = Record<Dimension, number>;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

const NEUTRAL_DIMENSION_SCORES: DimensionScores = Object.fromEntries(
  ALL_DIMENSIONS.map((d) => [d, 50]),
) as DimensionScores;

/**
 * Average, per rostered hero, how much a team's composition leans into each
 * strategic dimension - normalized to 0-100. Averaging (not summing) keeps
 * this meaningful for partial drafts (a 1-hero team isn't penalized just for
 * having fewer heroes than a full 5-stack).
 */
export function computeDimensionScores(
  heroes: Hero[],
  rawTagsById: Map<number, string[]>,
): DimensionScores {
  if (heroes.length === 0) return { ...NEUTRAL_DIMENSION_SCORES };

  const totals: Record<Dimension, number> = Object.fromEntries(
    ALL_DIMENSIONS.map((d) => [d, 0]),
  ) as Record<Dimension, number>;

  for (const hero of heroes) {
    const tags = rawTagsById.get(hero.id) ?? [];
    for (const tag of tags) {
      const weights = TAG_DIMENSION_WEIGHTS[tag];
      if (!weights) continue;
      for (const dimension of ALL_DIMENSIONS) {
        const w = weights[dimension];
        if (w) totals[dimension] += w;
      }
    }
  }

  const scores = {} as DimensionScores;
  for (const dimension of ALL_DIMENSIONS) {
    const avgContribution = totals[dimension] / heroes.length;
    scores[dimension] = Math.round(
      clamp((avgContribution / DIMENSION_NORMALIZATION_REFERENCE) * 100),
    );
  }
  return scores;
}

/**
 * Which dimensions matter for each phase, and how much - each phase's
 * weights sum to 1 (a documented, tested invariant; see scoring.ts's
 * SCORING_WEIGHTS for the same convention elsewhere in this codebase).
 */
const PHASE_DIMENSION_WEIGHTS: Record<GamePhase, Partial<Record<Dimension, number>>> = {
  early: { laning: 0.4, pickoff: 0.2, catch: 0.2, farming: 0.2 },
  mid: { teamfight: 0.35, push: 0.25, pickoff: 0.25, catch: 0.15 },
  late: { scaling: 0.5, teamfight: 0.25, sustain: 0.25 },
};

const PHASE_META: Record<GamePhase, { label: string; window: string }> = {
  early: { label: "Early Game", window: "0-15 min" },
  mid: { label: "Mid Game", window: "15-30 min" },
  late: { label: "Late Game", window: "30+ min" },
};

export function computePhaseScore(dims: DimensionScores, phase: GamePhase): number {
  const weights = PHASE_DIMENSION_WEIGHTS[phase];
  let score = 0;
  for (const [dimension, weight] of Object.entries(weights) as [Dimension, number][]) {
    score += dims[dimension] * weight;
  }
  return Math.round(score);
}

// Centralized so power-window and phase-advantage classification never
// scatter magic numbers across the module (see spec's "keep thresholds
// centralized" requirement).
const POWER_WINDOW_STRONG_THRESHOLD = 60;
const POWER_WINDOW_WEAK_THRESHOLD = 40;
const PHASE_ADVANTAGE_THRESHOLD = 8;
const STRONG_DIMENSION_THRESHOLD = 55;

export function classifyPowerWindow(score: number): PowerWindow {
  if (score >= POWER_WINDOW_STRONG_THRESHOLD) return "Strong";
  if (score <= POWER_WINDOW_WEAK_THRESHOLD) return "Weak";
  return "Moderate";
}

function relevantDimensionsSorted(
  dims: DimensionScores,
  phase: GamePhase,
): { dimension: Dimension; score: number }[] {
  const weights = PHASE_DIMENSION_WEIGHTS[phase];
  return (Object.keys(weights) as Dimension[])
    .map((dimension) => ({ dimension, score: dims[dimension] }))
    .sort((a, b) => b.score - a.score);
}

const DIMENSION_LABEL: Record<Dimension, string> = {
  laning: "lane pressure",
  teamfight: "teamfight control",
  pickoff: "pickoff potential",
  push: "objective pressure",
  scaling: "late-game scaling",
  farming: "farming flexibility",
  catch: "mobility and catch potential",
  sustain: "sustain and durability",
};
/**
 * Every template below is written from a team's own point of view, so the
 * same dimension scoring can describe either side without ever putting
 * "your" in the enemy team's copy (a real bug an earlier version of this
 * had: the enemy card literally told the reader to lean on "your" pickoff
 * potential).
 */
interface Perspective {
  possessive: string;
  opponentPossessive: string;
}
const YOUR_PERSPECTIVE: Perspective = { possessive: "your", opponentPossessive: "the enemy's" };
const ENEMY_PERSPECTIVE: Perspective = { possessive: "their", opponentPossessive: "your" };

const DIMENSION_PRIORITY: Record<Dimension, (p: Perspective) => string> = {
  laning: (p) => `Contest and win ${p.possessive} strongest lanes`,
  teamfight: (p) => `Group for coordinated fights around ${p.possessive} control`,
  pickoff: (p) => `Look for chances to isolate a single hero from ${p.opponentPossessive} team`,
  push: () => `Convert map control into towers and objectives`,
  scaling: (p) => `Prioritize farm for ${p.possessive} scaling core(s)`,
  farming: () => `Use flexible farming patterns to keep tempo up`,
  catch: () => `Use mobility to catch heroes who overextend`,
  sustain: (p) => `Hold space using ${p.possessive} durability and sustain`,
};
const DIMENSION_AVOID: Record<Dimension, (p: Perspective) => string> = {
  laning: () => `Passive laning that hands over early tempo`,
  teamfight: (p) => `Grouping for fights without ${p.possessive} control abilities up`,
  pickoff: () => `Chasing kills without vision or a setup`,
  push: () => `Split-pushing without wave or tower support`,
  scaling: () => `Long, low-value fights that just burn time`,
  farming: () => `Over-committing to farm while losing the map`,
  catch: () => `Engaging mobile targets without disables ready`,
  sustain: (p) => `Extended fights without ${p.possessive} durable or sustain heroes`,
};

function buildGamePlan(
  ranked: { dimension: Dimension; score: number }[],
  perspective: Perspective,
): string {
  const [top, second] = ranked;
  if (top.score >= STRONG_DIMENSION_THRESHOLD) {
    const combine =
      second && second.score >= STRONG_DIMENSION_THRESHOLD - 5
        ? ` and ${DIMENSION_LABEL[second.dimension]}`
        : "";
    return `Lean on ${perspective.possessive} ${DIMENSION_LABEL[top.dimension]}${combine} to take control of this phase.`;
  }
  return `No standout strength this phase - play patiently around ${perspective.possessive} ${DIMENSION_LABEL[top.dimension]} rather than forcing the issue.`;
}

function buildPriorities(
  ranked: { dimension: Dimension; score: number }[],
  perspective: Perspective,
): string[] {
  const strong = ranked.filter((r) => r.score >= STRONG_DIMENSION_THRESHOLD).slice(0, 3);
  if (!strong.length)
    return [
      `Play for information and avoid unnecessary risk while ${perspective.possessive} draft's identity develops`,
    ];
  return strong.map((r) => DIMENSION_PRIORITY[r.dimension](perspective));
}

function buildAvoid(
  ranked: { dimension: Dimension; score: number }[],
  perspective: Perspective,
): string[] {
  const weakest = ranked[ranked.length - 1];
  return [DIMENSION_AVOID[weakest.dimension](perspective)];
}

function buildTeamPhaseStrategy(
  phase: GamePhase,
  dims: DimensionScores,
  perspective: Perspective,
): PhaseTeamStrategy {
  const ranked = relevantDimensionsSorted(dims, phase);
  return {
    gamePlan: buildGamePlan(ranked, perspective),
    priorities: buildPriorities(ranked, perspective),
    avoid: buildAvoid(ranked, perspective),
    powerWindow: classifyPowerWindow(computePhaseScore(dims, phase)),
  };
}

function classifyAdvantage(yourScore: number, enemyScore: number): PhaseAdvantage {
  if (Math.abs(yourScore - enemyScore) < PHASE_ADVANTAGE_THRESHOLD) return "even";
  return yourScore > enemyScore ? "your" : "enemy";
}

function buildAdvantageReason(
  advantage: PhaseAdvantage,
  phase: GamePhase,
  yourDims: DimensionScores,
  enemyDims: DimensionScores,
): string {
  if (advantage === "even")
    return `Both teams have similar ${PHASE_META[phase].label.toLowerCase()} potential based on current picks.`;
  const leaderDims = advantage === "your" ? yourDims : enemyDims;
  const top = relevantDimensionsSorted(leaderDims, phase)[0];
  return advantage === "your"
    ? `Your draft's ${DIMENSION_LABEL[top.dimension]} outweighs the enemy's this phase.`
    : `The enemy draft's ${DIMENSION_LABEL[top.dimension]} outweighs your team's this phase.`;
}

/** Confidence reflects how much real tag data actually backed this phase's numbers, not the strategic conclusion's importance. */
function computeConfidence(heroes: Hero[], rawTagsById: Map<number, string[]>): InsightConfidence {
  if (heroes.length === 0) return "low";
  const withTags = heroes.filter((h) => (rawTagsById.get(h.id)?.length ?? 0) > 0).length;
  const ratio = withTags / heroes.length;
  if (heroes.length >= 3 && ratio >= 0.8) return "high";
  if (heroes.length >= 2 && ratio >= 0.5) return "medium";
  return "low";
}

const CONFIDENCE_RANK: Record<InsightConfidence, number> = { high: 2, medium: 1, low: 0 };
function lowerConfidence(a: InsightConfidence, b: InsightConfidence): InsightConfidence {
  return CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b;
}

function buildPhaseComparison(
  phase: GamePhase,
  yourHeroes: Hero[],
  enemyHeroes: Hero[],
  yourDims: DimensionScores,
  enemyDims: DimensionScores,
  yourConfidence: InsightConfidence,
  enemyConfidence: InsightConfidence,
): PhaseComparison {
  const yourScore = computePhaseScore(yourDims, phase);
  const enemyScore = computePhaseScore(enemyDims, phase);
  const advantage = classifyAdvantage(yourScore, enemyScore);
  return {
    phase,
    label: PHASE_META[phase].label,
    window: PHASE_META[phase].window,
    advantage,
    reason: buildAdvantageReason(advantage, phase, yourDims, enemyDims),
    yourTeam: buildTeamPhaseStrategy(phase, yourDims, YOUR_PERSPECTIVE),
    enemyTeam: buildTeamPhaseStrategy(phase, enemyDims, ENEMY_PERSPECTIVE),
    confidence: lowerConfidence(yourConfidence, enemyConfidence),
  };
}

function buildWinCondition(team: "your" | "enemy", dims: DimensionScores): string {
  const phases: GamePhase[] = ["early", "mid", "late"];
  const scored = phases.map((phase) => ({ phase, score: computePhaseScore(dims, phase) }));
  const best = scored.reduce((top, cur) => (cur.score > top.score ? cur : top));
  const top = relevantDimensionsSorted(dims, best.phase)[0];
  const subject = team === "your" ? "Your draft" : "The enemy's draft";
  const possessive = team === "your" ? "your" : "their";
  return `${subject} is built to peak in the ${PHASE_META[best.phase].label.toLowerCase()} - lean on ${DIMENSION_LABEL[top.dimension]} to force the game to happen on ${possessive} terms.`;
}

/**
 * Builds the full Advanced Insights strategic timeline for a draft.
 * `rawTagsById` should already contain an entry for every hero in both
 * teams (see heroService.ts's `getRawRoleTags`, backed by the same cached
 * heroStats snapshot the rest of the recommendation engine uses - no extra
 * OpenDota requests are made here).
 */
export function buildAdvancedInsights(
  yourHeroes: Hero[],
  enemyHeroes: Hero[],
  rawTagsById: Map<number, string[]>,
): AdvancedInsights {
  const yourDims = computeDimensionScores(yourHeroes, rawTagsById);
  const enemyDims = computeDimensionScores(enemyHeroes, rawTagsById);
  const yourConfidence = computeConfidence(yourHeroes, rawTagsById);
  const enemyConfidence = computeConfidence(enemyHeroes, rawTagsById);

  return {
    early: buildPhaseComparison(
      "early",
      yourHeroes,
      enemyHeroes,
      yourDims,
      enemyDims,
      yourConfidence,
      enemyConfidence,
    ),
    mid: buildPhaseComparison(
      "mid",
      yourHeroes,
      enemyHeroes,
      yourDims,
      enemyDims,
      yourConfidence,
      enemyConfidence,
    ),
    late: buildPhaseComparison(
      "late",
      yourHeroes,
      enemyHeroes,
      yourDims,
      enemyDims,
      yourConfidence,
      enemyConfidence,
    ),
    yourWinCondition: buildWinCondition("your", yourDims),
    enemyWinCondition: buildWinCondition("enemy", enemyDims),
  };
}

// Exported for unit testing / reuse without recomputing.
export { PHASE_DIMENSION_WEIGHTS, ALL_DIMENSIONS };
export type { Dimension };
