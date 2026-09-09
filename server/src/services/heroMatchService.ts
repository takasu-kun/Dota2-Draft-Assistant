import type { HeroMatch } from "../types/domain.js";
import { AsyncCache } from "./cache.js";
import { openDotaClient, type RawHeroMatch } from "./openDotaClient.js";

// OpenDota's /heroes/{id}/matches has no pagination params - it always
// returns its full result (professional/league matches only, newest
// first, up to ~100). We fetch it once per hero and cache it, then page
// through the cached array ourselves for "Load More".
const HERO_MATCHES_TTL_MS = 10 * 60 * 1000;
const heroMatchesCache = new AsyncCache<number, RawHeroMatch[]>(HERO_MATCHES_TTL_MS);

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
  const raw = await heroMatchesCache.get(heroId, () => openDotaClient.getHeroMatches(heroId));
  return paginateMatches(raw.map(toHeroMatch), opts);
}
