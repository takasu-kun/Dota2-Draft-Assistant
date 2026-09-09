import type { BuildCategory } from "../types/domain.js";
import { AsyncCache } from "./cache.js";
import {
  openDotaClient,
  type RawItemConstant,
  type RawPurchaseLogEntry,
} from "./openDotaClient.js";

/**
 * Shared primitives for turning a match's raw `purchase_log` into build data,
 * used by both a single match's item timeline (heroMatchService.ts) and the
 * aggregated hero build across many matches (heroBuildService.ts).
 */

// Deterministic, documented purchase-time thresholds (seconds from game
// start) - not an OpenDota concept. These mirror the boundaries OpenDota's
// own (now-unused-here) itemPopularity endpoint used for start/early/mid/late
// game items, so the categorization stays consistent with that convention.
const EARLY_GAME_SECONDS = 10 * 60;
const CORE_GAME_SECONDS = 25 * 60;

export function categorizeByTime(seconds: number): BuildCategory {
  if (seconds <= 0) return "starting";
  if (seconds <= EARLY_GAME_SECONDS) return "early";
  if (seconds <= CORE_GAME_SECONDS) return "core";
  return "situational";
}

/**
 * Collapses a match's purchase log to one entry per distinct item (its
 * earliest purchase time), so a hero rebuying tangoes/wards/TP scrolls
 * doesn't clutter a timeline or inflate a single match's contribution to
 * the aggregate build. Recipe scrolls are dropped - they're a checkout
 * artifact of buying a component item, not a build choice in themselves.
 */
export function extractFirstPurchasePerItem(
  log: RawPurchaseLogEntry[] | null | undefined,
): Map<string, number> {
  const firstPurchaseTime = new Map<string, number>();
  for (const entry of log ?? []) {
    if (entry.key.startsWith("recipe_")) continue;
    const existing = firstPurchaseTime.get(entry.key);
    if (existing === undefined || entry.time < existing)
      firstPurchaseTime.set(entry.key, entry.time);
  }
  return firstPurchaseTime;
}

// Item metadata (names/images) changes only with game patches.
const ITEM_CONSTANTS_TTL_MS = 60 * 60 * 1000;
const itemConstantsCache = new AsyncCache<"all", Record<string, RawItemConstant>>(
  ITEM_CONSTANTS_TTL_MS,
);

/** `GET /constants/items`, keyed by internal item name (e.g. "tango") - the same string `purchase_log[].key` uses. */
export async function getItemConstants(): Promise<Record<string, RawItemConstant>> {
  return itemConstantsCache.get("all", () => openDotaClient.getItemConstants());
}

export interface ResolvedItem {
  itemId: number;
  name: string;
  image: string | null;
}

/** Resolves a purchase_log `key` to display info, or null if it's not a known item. */
export function resolveItem(
  key: string,
  itemsByName: Record<string, RawItemConstant>,
): ResolvedItem | null {
  const item = itemsByName[key];
  if (!item) return null;
  return {
    itemId: item.id,
    name: item.dname ?? key,
    image: item.img ? `https://cdn.cloudflare.steamstatic.com${item.img}` : null,
  };
}
