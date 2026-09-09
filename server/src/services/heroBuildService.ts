import type { BuildItem, HeroBuild } from "../types/domain.js";
import { AsyncCache } from "./cache.js";
import {
  categorizeByTime,
  extractFirstPurchasePerItem,
  getItemConstants,
  resolveItem,
} from "./itemBuild.js";
import { getRawHeroMatches, getRawMatchDetail } from "./heroMatchService.js";
import type { RawItemConstant } from "./openDotaClient.js";
import { mapWithConcurrency } from "./concurrency.js";

/**
 * Aggregates a hero's build from real match data:
 *
 *   recent hero matches -> match details -> this hero's player in each ->
 *   purchase_log -> tally which matches bought which item -> percentage
 *   = matches that bought it / matches analyzed
 *
 * OpenDota has no "recommended build" endpoint, so this is our own
 * aggregation over individual matches (see itemBuild.ts for the shared
 * purchase-log/categorization logic also used by a single match's item
 * timeline). Analyzing *every* pro match for a popular hero (up to ~100)
 * would mean ~100 upstream requests per build lookup - too slow and too
 * close to OpenDota's free-tier rate limit - so this bounds the sample and
 * reports the real, possibly-smaller number analyzed rather than pretending
 * otherwise.
 */
const ANALYZED_MATCH_LIMIT = 20;
const MATCH_DETAIL_CONCURRENCY = 5;
const ITEMS_PER_CATEGORY = 8;
// Our own sample is capped at ANALYZED_MATCH_LIMIT, so this threshold is
// relative to that, not to some larger "ideal" sample.
const LOW_CONFIDENCE_THRESHOLD = 10;

/**
 * One analyzed match's contribution: the set of distinct items it bought
 * (item key -> first purchase time), or null if this match had no usable
 * purchase data for the hero (unparsed match, fetch failure, etc.) and
 * should be excluded from both the numerator and the denominator.
 */
async function analyzeMatchForHero(
  heroId: number,
  matchId: number,
): Promise<Map<string, number> | null> {
  try {
    const match = await getRawMatchDetail(matchId);
    const player = match.players.find((p) => p.hero_id === heroId);
    const purchases = extractFirstPurchasePerItem(player?.purchase_log);
    return purchases.size > 0 ? purchases : null;
  } catch {
    return null; // one match's detail failing shouldn't fail the whole build
  }
}

/** Exported (rather than kept private) so item grouping/percentage/insufficient-data logic is unit-testable with fixture data. */
export function buildItemsFromCounts(
  counts: Map<string, number>,
  sampleSize: number,
  itemsByName: Record<string, RawItemConstant>,
): BuildItem[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, ITEMS_PER_CATEGORY)
    .map(([key, count]): BuildItem => {
      const resolved = resolveItem(key, itemsByName);
      return {
        itemId: resolved?.itemId ?? -1,
        name: resolved?.name ?? key,
        image: resolved?.image ?? null,
        count,
        percentage: sampleSize > 0 ? Math.round((count / sampleSize) * 100) : 0,
      };
    });
}

/**
 * Tallies, per build category, how many analyzed matches bought each item
 * at least once. Exported (rather than kept private) so this grouping step
 * is unit-testable with fixture data, without a network call.
 */
export function tallyByCategory(perMatchPurchases: Map<string, number>[]) {
  const countsByCategory = {
    starting: new Map<string, number>(),
    early: new Map<string, number>(),
    core: new Map<string, number>(),
    situational: new Map<string, number>(),
  };
  for (const purchases of perMatchPurchases) {
    for (const [key, time] of purchases) {
      const map = countsByCategory[categorizeByTime(time)];
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }
  return countsByCategory;
}

const heroBuildCache = new AsyncCache<number, HeroBuild>(10 * 60 * 1000);

export async function getHeroBuild(heroId: number): Promise<HeroBuild> {
  return heroBuildCache.get(heroId, () => computeHeroBuild(heroId));
}

async function computeHeroBuild(heroId: number): Promise<HeroBuild> {
  const [rawMatches, itemsByName] = await Promise.all([
    getRawHeroMatches(heroId),
    getItemConstants(),
  ]);
  const candidateMatchIds = rawMatches.slice(0, ANALYZED_MATCH_LIMIT).map((m) => m.match_id);

  const perMatchPurchases = await mapWithConcurrency(
    candidateMatchIds,
    MATCH_DETAIL_CONCURRENCY,
    (id) => analyzeMatchForHero(heroId, id),
  );
  const usableMatches = perMatchPurchases.filter((m): m is Map<string, number> => m !== null);
  const sampleSize = usableMatches.length;
  const countsByCategory = tallyByCategory(usableMatches);

  return {
    heroId,
    sampleSize,
    lowConfidence: sampleSize < LOW_CONFIDENCE_THRESHOLD,
    startingItems: buildItemsFromCounts(countsByCategory.starting, sampleSize, itemsByName),
    earlyItems: buildItemsFromCounts(countsByCategory.early, sampleSize, itemsByName),
    coreItems: buildItemsFromCounts(countsByCategory.core, sampleSize, itemsByName),
    situationalItems: buildItemsFromCounts(countsByCategory.situational, sampleSize, itemsByName),
  };
}
