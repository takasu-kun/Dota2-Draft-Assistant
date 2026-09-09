import type { HeroMatch, HeroMatchDetail, MatchItemPurchase } from "../types/domain.js";
import { AsyncCache } from "./cache.js";
import {
  categorizeByTime,
  extractFirstPurchasePerItem,
  getItemConstants,
  resolveItem,
} from "./itemBuild.js";
import { openDotaClient, type RawHeroMatch, type RawMatchDetail } from "./openDotaClient.js";

// OpenDota's /heroes/{id}/matches has no pagination params - it always
// returns its full result (professional/league matches only, newest
// first, up to ~100). We fetch it once per hero and cache it, then page
// through the cached array ourselves for "Load More", and also reuse it
// (via getRawHeroMatches) as the candidate list for the aggregated build.
const HERO_MATCHES_TTL_MS = 10 * 60 * 1000;
const heroMatchesCache = new AsyncCache<number, RawHeroMatch[]>(HERO_MATCHES_TTL_MS);

export async function getRawHeroMatches(heroId: number): Promise<RawHeroMatch[]> {
  return heroMatchesCache.get(heroId, () => openDotaClient.getHeroMatches(heroId));
}

// A finished match's data never changes, so this can be cached far longer
// than everything else - and it's shared between a single match's item
// timeline (below) and the aggregated build (heroBuildService.ts), so
// analyzing the same match for both doesn't cost two upstream calls.
const MATCH_DETAIL_TTL_MS = 24 * 60 * 60 * 1000;
const matchDetailCache = new AsyncCache<number, RawMatchDetail>(MATCH_DETAIL_TTL_MS);

export async function getRawMatchDetail(matchId: number): Promise<RawMatchDetail> {
  return matchDetailCache.get(matchId, () => openDotaClient.getMatchDetail(matchId));
}

/** Exported (rather than kept private) so it can be unit-tested with fixture data, without a network call. */
export function toHeroMatch(raw: RawHeroMatch): HeroMatch {
  const heroWasRadiant = raw.player_slot < 128;
  return {
    matchId: raw.match_id,
    startTime: raw.start_time,
    duration: raw.duration,
    win: heroWasRadiant === raw.radiant_win,
    kills: raw.kills,
    deaths: raw.deaths,
    assists: raw.assists,
    leagueName: raw.league_name?.trim() || null,
  };
}

export interface HeroMatchPage {
  matches: HeroMatch[];
  total: number;
  hasMore: boolean;
}

/** Exported (rather than kept private) so pagination edge cases are unit-testable without a network call. */
export function paginateMatches(
  all: HeroMatch[],
  { limit = 15, offset = 0 }: { limit?: number; offset?: number } = {},
): HeroMatchPage {
  return {
    matches: all.slice(offset, offset + limit),
    total: all.length,
    hasMore: offset + limit < all.length,
  };
}

export async function getHeroMatches(
  heroId: number,
  opts: { limit?: number; offset?: number } = {},
): Promise<HeroMatchPage> {
  const raw = await getRawHeroMatches(heroId);
  return paginateMatches(raw.map(toHeroMatch), opts);
}

/**
 * Finds the player who used `heroId` in `matchId` and returns their result
 * plus item purchase timeline. Returns null if that hero wasn't in that
 * match (the caller maps this to a 404) rather than throwing, since it's a
 * normal "not found" outcome, not a failure.
 */
export async function getHeroMatchDetail(
  heroId: number,
  matchId: number,
): Promise<HeroMatchDetail | null> {
  const [match, itemsByName] = await Promise.all([getRawMatchDetail(matchId), getItemConstants()]);
  const player = match.players.find((p) => p.hero_id === heroId);
  if (!player) return null;

  const heroWasRadiant = player.player_slot < 128;
  const firstPurchaseTime = extractFirstPurchasePerItem(player.purchase_log);
  const items: MatchItemPurchase[] = [...firstPurchaseTime.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([key, timestamp]): MatchItemPurchase | null => {
      const resolved = resolveItem(key, itemsByName);
      return resolved && { ...resolved, timestamp, category: categorizeByTime(timestamp) };
    })
    .filter((item): item is MatchItemPurchase => item !== null);

  return {
    matchId,
    heroId,
    win: heroWasRadiant === match.radiant_win,
    duration: match.duration,
    kills: player.kills,
    deaths: player.deaths,
    assists: player.assists,
    heroLevel: player.level,
    items,
  };
}
