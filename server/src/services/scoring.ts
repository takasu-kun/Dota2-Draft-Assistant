import type { ScoreBreakdown } from "../types/domain.js";

/**
 * Centralized recommendation-scoring weights - the only place these numbers
 * live, so nothing else in the recommendation engine hardcodes a percentage.
 */
export const SCORING_WEIGHTS = {
  counter: 0.4,
  synergy: 0.3,
  roleFit: 0.15,
  meta: 0.15,
} as const;

export function computeFinalScore(breakdown: ScoreBreakdown): number {
  return Math.round(
    breakdown.counter * SCORING_WEIGHTS.counter +
      breakdown.synergy * SCORING_WEIGHTS.synergy +
      breakdown.roleFit * SCORING_WEIGHTS.roleFit +
      breakdown.meta * SCORING_WEIGHTS.meta,
  );
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

// Meta Score answers "how strong/popular is this hero right now?" - kept
// entirely separate from Role Fit (see roleFitService.ts), which only
// answers "does this hero suit the requested position?". A hero can be
// strong in the current meta but a poor fit for the role the user asked
// for, or vice versa; the two must never collapse into the same number.
const META_WIN_RATE_BASELINE = 50;
// Public win rates rarely stray far from 50%, so deviation from baseline is
// amplified to use more of the 0-100 range - same technique roleFitService
// uses for role performance, applied here to overall meta win rate.
const META_WIN_RATE_AMPLIFICATION = 4;
// Pick rate is a share of the whole hero pool (usually low single digits to
// ~20% for very popular picks), so it's scaled up before clamping to 100.
const META_PICK_RATE_SCALE = 5;
const META_WIN_RATE_WEIGHT = 0.7;
const META_PICK_RATE_WEIGHT = 0.3;
const META_NEUTRAL_COMPONENT = 50;

/**
 * Meta Score from a hero's overall (not role- or matchup-specific) win rate
 * and pick rate - both already computed from real OpenDota data in
 * heroService.ts. Missing data for either component falls back to a
 * neutral 50 for that component rather than being fabricated.
 */
export function computeMetaScore(hero: {
  winRate: number | null;
  pickRate: number | null;
}): number {
  const winRateComponent =
    hero.winRate === null
      ? META_NEUTRAL_COMPONENT
      : clamp(
          META_WIN_RATE_BASELINE +
            (hero.winRate - META_WIN_RATE_BASELINE) * META_WIN_RATE_AMPLIFICATION,
        );
  const pickRateComponent =
    hero.pickRate === null ? META_NEUTRAL_COMPONENT : clamp(hero.pickRate * META_PICK_RATE_SCALE);
  return Math.round(
    winRateComponent * META_WIN_RATE_WEIGHT + pickRateComponent * META_PICK_RATE_WEIGHT,
  );
}
