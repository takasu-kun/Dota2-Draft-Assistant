import type { Role } from "../types/domain.js";
import { AsyncCache } from "./cache.js";
import { openDotaClient } from "./openDotaClient.js";

/**
 * Role Fit answers "how appropriate is this hero for the role the user
 * wants to play?" - using real, hero-specific OpenDota data wherever it
 * exists, per this priority order (see each section below):
 *
 *   1. Position-specific match data (lane + roaming behavior)
 *   2. (no distinct role-specific-stats endpoint exists on OpenDota's
 *      public API beyond position data, so this tier is folded into #1)
 *   3. Hero role metadata (the broad tag list from heroStats) - fallback
 *   4. No data at all - neutral default
 *
 * OpenDota's public API has no endpoint for "win rate by application
 * position (1-5)" - that 5-way split is a community convention, not a
 * column in their data. What IS real and queryable (via /explorer over
 * player_matches) is each match's `lane_role` (1=safe, 2=mid, 3=off) and
 * `is_roaming` (a support playing away from their assigned lane). That
 * reliably identifies carry/mid/offlane. It cannot reliably split
 * support (pos 4) from hard support (pos 5) - both show up identically
 * as "roaming games" in this data - so both draw from the same evidence,
 * which is documented here rather than faked with a false distinction.
 */

export interface PositionBucket {
  laneRole: 1 | 2 | 3;
  roaming: boolean;
  games: number;
  wins: number;
}

const POSITION_WINDOW_DAYS = 180;

function positionQuery(heroId: number): string {
  // heroId is always a zod-validated positive int by the time it reaches
  // this function, but guard again since it's interpolated into raw SQL
  // (the /explorer endpoint has no parameter binding).
  if (!Number.isInteger(heroId) || heroId <= 0) throw new Error("Invalid hero id.");
  return `
    SELECT pm.lane_role, pm.is_roaming, COUNT(*) AS games,
      SUM(CASE WHEN ((pm.player_slot < 128) = m.radiant_win) THEN 1 ELSE 0 END) AS wins
    FROM player_matches pm
    JOIN matches m ON m.match_id = pm.match_id
    WHERE pm.hero_id = ${heroId}
      AND pm.lane_role IS NOT NULL
      AND m.start_time > extract(epoch FROM now() - interval '${POSITION_WINDOW_DAYS} days')::int
    GROUP BY pm.lane_role, pm.is_roaming
  `;
}

interface RawPositionRow {
  lane_role: number;
  is_roaming: boolean | null;
  games: string | number;
  wins: string | number;
}

const POSITION_TTL_MS = 10 * 60 * 1000;
const positionCache = new AsyncCache<number, PositionBucket[]>(POSITION_TTL_MS);

async function getPositionBuckets(heroId: number): Promise<PositionBucket[]> {
  return positionCache.get(heroId, async () => {
    const { rows } = await openDotaClient.explorer<RawPositionRow>(positionQuery(heroId));
    return rows
      .filter((r): r is RawPositionRow & { lane_role: 1 | 2 | 3 } =>
        [1, 2, 3].includes(r.lane_role),
      )
      .map((r) => ({
        laneRole: r.lane_role,
        roaming: r.is_roaming === true,
        games: Number(r.games),
        wins: Number(r.wins),
      }));
  });
}

/** Which position buckets count as evidence for each application role. */
function bucketsForRole(buckets: PositionBucket[], role: Role): PositionBucket[] {
  switch (role) {
    case "carry":
      return buckets.filter((b) => b.laneRole === 1 && !b.roaming);
    case "mid":
      return buckets.filter((b) => b.laneRole === 2 && !b.roaming);
    case "offlane":
      return buckets.filter((b) => b.laneRole === 3 && !b.roaming);
    case "support":
    case "hard-support":
      // Can't be told apart in OpenDota's data (see file header) - both
      // roles read the same roaming-game evidence.
      return buckets.filter((b) => b.roaming);
  }
}

// A hero rarely played a given way shouldn't score as confidently as one
// played that way constantly, but also shouldn't be crushed to zero from a
// handful of games - this many "phantom" 50%-win games are blended in
// (a standard shrinkage/Bayesian-average technique) so small samples pull
// toward neutral instead of swinging on noise. This has to be large enough
// that e.g. a 60% win rate over 50 games doesn't outrank a 55% win rate
// over 10,000 games (worked example: shrunk to ~52% vs ~55%, so the large
// reliable sample correctly wins) - a weak prior lets a lucky small sample
// dominate a far more reliable large one, which is exactly the failure mode
// this is meant to prevent.
const SHRINKAGE_PRIOR_GAMES = 200;
const SHRINKAGE_PRIOR_WIN_RATE = 0.5;
// A shrunk win rate rarely strays far from 50%, so deviation from it is
// amplified by this factor to use more of the 0-100 output range.
const WIN_RATE_AMPLIFICATION = 3;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Real, position-specific Role Fit: half of it is *prevalence* (what share
 * of this hero's sampled games were even played this way - a hero played
 * this way constantly clearly "fits", independent of win rate), half is
 * *performance* (a shrunk, sample-size-aware win rate in that role). Each
 * half is weighted equally and documented rather than left as a magic
 * combination.
 */
export function scoreFromPositionData(buckets: PositionBucket[], role: Role): number | null {
  const totalGames = buckets.reduce((sum, b) => sum + b.games, 0);
  if (totalGames === 0) return null;

  const roleBuckets = bucketsForRole(buckets, role);
  const roleGames = roleBuckets.reduce((sum, b) => sum + b.games, 0);
  if (roleGames === 0) return 0; // real data exists for this hero, just never in this role

  const roleWins = roleBuckets.reduce((sum, b) => sum + b.wins, 0);
  const prevalence = roleGames / totalGames;

  const shrunkWinRate =
    (roleWins + SHRINKAGE_PRIOR_WIN_RATE * SHRINKAGE_PRIOR_GAMES) /
    (roleGames + SHRINKAGE_PRIOR_GAMES);
  const performance = clamp01(0.5 + (shrunkWinRate - 0.5) * WIN_RATE_AMPLIFICATION);

  return Math.round(100 * (0.5 * prevalence + 0.5 * performance));
}

/**
 * Fallback only: used when a hero has zero position data at all (new
 * heroes, or ones with too little recent pro/high-MMR play to have any
 * lane_role rows). This is OpenDota's real hero role *tags* - genuine
 * data, just not position-specific - mapped to our five positions by a
 * hand-written, clearly-labeled heuristic table, per the rule that a
 * fallback mapping must be centralized and never silently blended with
 * real statistics. Kept separate from heroService.ts's own (slightly
 * different-purpose) lane-role heuristic used for hero filtering.
 */
const FALLBACK_ROLE_TAGS: Record<string, Role[]> = {
  Carry: ["carry"],
  Escape: ["carry"],
  Jungler: ["carry"],
  Pusher: ["mid", "carry"],
  Nuker: ["mid"],
  Initiator: ["offlane"],
  Durable: ["offlane"],
  Disabler: ["offlane", "support"],
  Support: ["support", "hard-support"],
};
const FALLBACK_SCORE_IF_TAGGED = 55;
const FALLBACK_SCORE_IF_NOT_TAGGED = 45;
const NEUTRAL_SCORE = 50;

/** Exported (rather than kept private) so the fallback tier is unit-testable without a network call. */
export function scoreFromTags(tags: string[], role: Role): number {
  const fits = tags.some((tag) => FALLBACK_ROLE_TAGS[tag]?.includes(role));
  return fits ? FALLBACK_SCORE_IF_TAGGED : FALLBACK_SCORE_IF_NOT_TAGGED;
}

export type RoleFitSource = "position-data" | "role-tags" | "no-data";

export interface RoleFitResult {
  score: number;
  source: RoleFitSource;
}

/**
 * `rawTags` are the hero's OpenDota `roles` (e.g. ["Support","Disabler"]),
 * used only as the last-resort fallback described above.
 */
export async function getRoleFit(
  heroId: number,
  role: Role,
  rawTags: string[],
): Promise<RoleFitResult> {
  let buckets: PositionBucket[];
  try {
    buckets = await getPositionBuckets(heroId);
  } catch {
    buckets = []; // treat an explorer failure like "no position data" rather than failing the whole recommendation
  }

  const positionScore = scoreFromPositionData(buckets, role);
  if (positionScore !== null) return { score: positionScore, source: "position-data" };
  if (rawTags.length > 0) return { score: scoreFromTags(rawTags, role), source: "role-tags" };
  return { score: NEUTRAL_SCORE, source: "no-data" };
}
