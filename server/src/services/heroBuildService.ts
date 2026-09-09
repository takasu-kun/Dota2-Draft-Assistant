import type { BuildItem, HeroBuild } from "../types/domain.js";
import { AsyncCache } from "./cache.js";
import { openDotaClient, type RawItemConstant, type RawItemPopularity } from "./openDotaClient.js";

/**
 * OpenDota's public API has no "recommended build" endpoint, and no
 * skill-build or talent-pick data at all (verified against
 * https://docs.opendota.com/ - only `/heroes/{id}/itemPopularity` exists,
 * covering items). So this builds a real item build from that endpoint,
 * and skill/talent sections are simply not part of `HeroBuild` - showing
 * them would mean fabricating data OpenDota doesn't provide.
 */
const ITEM_POPULARITY_TTL_MS = 10 * 60 * 1000;
const itemPopularityCache = new AsyncCache<number, RawItemPopularity>(ITEM_POPULARITY_TTL_MS);

// Item metadata (names/images) changes only with game patches.
const ITEM_CONSTANTS_TTL_MS = 60 * 60 * 1000;
const itemConstantsCache = new AsyncCache<"all", Map<number, RawItemConstant>>(
  ITEM_CONSTANTS_TTL_MS,
);

async function getItemConstantsById(): Promise<Map<number, RawItemConstant>> {
  return itemConstantsCache.get("all", async () => {
    const raw = await openDotaClient.getItemConstants();
    return new Map(Object.values(raw).map((item) => [item.id, item]));
  });
}

const ITEMS_PER_CATEGORY = 8;

/** Exported (rather than kept private) so aggregation/percentage logic is unit-testable with fixture data. */
export function toBuildItems(
  counts: Record<string, number>,
  itemsById: Map<number, RawItemConstant>,
): BuildItem[] {
  const entries = Object.entries(counts)
    .map(([id, count]) => ({ itemId: Number(id), count }))
    .filter((e) => Number.isInteger(e.itemId) && e.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, ITEMS_PER_CATEGORY);
  const maxCount = entries[0]?.count ?? 0;
  return entries.map(({ itemId, count }): BuildItem => {
    const item = itemsById.get(itemId);
    return {
      itemId,
      name: item?.dname ?? `Item ${itemId}`,
      image: item?.img ? `https://cdn.cloudflare.steamstatic.com${item.img}` : null,
      count,
      percentage: maxCount > 0 ? Math.round((count / maxCount) * 100) : 0,
    };
  });
}

// Below this many purchases of the category's most common item, the sample
// is too thin to present as a confident build recommendation.
const LOW_CONFIDENCE_THRESHOLD = 20;

/** Exported (rather than kept private) so sample-size/low-confidence logic is unit-testable with fixture data. */
export function summarizeHeroBuild(
  heroId: number,
  popularity: RawItemPopularity,
  itemsById: Map<number, RawItemConstant>,
): HeroBuild {
  const startingItems = toBuildItems(popularity.start_game_items, itemsById);
  const earlyItems = toBuildItems(popularity.early_game_items, itemsById);
  const coreItems = toBuildItems(popularity.mid_game_items, itemsById);
  const situationalItems = toBuildItems(popularity.late_game_items, itemsById);

  // Best-effort proxy for "how many matches was this analyzed from": the
  // most-purchased starting item is bought in nearly every game (tangoes,
  // wards, branches), so its count approximates the match sample. OpenDota
  // doesn't give us an exact match count for this endpoint.
  const sampleSize = Math.max(
    startingItems[0]?.count ?? 0,
    earlyItems[0]?.count ?? 0,
    coreItems[0]?.count ?? 0,
    situationalItems[0]?.count ?? 0,
  );

  return {
    heroId,
    sampleSize,
    lowConfidence: sampleSize < LOW_CONFIDENCE_THRESHOLD,
    startingItems,
    earlyItems,
    coreItems,
    situationalItems,
  };
}

export async function getHeroBuild(heroId: number): Promise<HeroBuild> {
  const [popularity, itemsById] = await Promise.all([
    itemPopularityCache.get(heroId, () => openDotaClient.getItemPopularity(heroId)),
    getItemConstantsById(),
  ]);
  return summarizeHeroBuild(heroId, popularity, itemsById);
}
