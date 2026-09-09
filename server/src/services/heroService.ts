import type { Hero, HeroRelationship, Role } from "../types/domain.js";
import { AsyncCache } from "./cache.js";
import { openDotaClient, type RawHeroStat, type RawMatchup } from "./openDotaClient.js";

const ATTRIBUTE_NAMES: Record<RawHeroStat["primary_attr"], string> = {
  str: "strength",
  agi: "agility",
  int: "intelligence",
  all: "universal",
};

/**
 * OpenDota's `roles` field on a hero is a set of functional tags (Carry,
 * Support, Nuker, Initiator, ...) - not a lane position. Our app's `Role`
 * type IS a lane position (carry/mid/offlane/support/hard-support), which
 * OpenDota does not expose directly. This table is a best-effort heuristic
 * mapping from OpenDota's tags to plausible lane roles; it is not ground
 * truth. A hero can map to more than one lane role.
 */
const LANE_ROLE_HEURISTIC: Record<string, Role[]> = {
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

function mapLaneRoles(rawRoles: string[]): Role[] {
  const roles = new Set<Role>();
  for (const raw of rawRoles) {
    for (const role of LANE_ROLE_HEURISTIC[raw] ?? []) roles.add(role);
  }
  return [...roles];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function toHero(raw: RawHeroStat, totalPubMatches: number, totalProMatches: number): Hero {
  return {
    id: raw.id,
    name: raw.localized_name,
    shortName: raw.name.replace("npc_dota_hero_", ""),
    primaryAttribute: ATTRIBUTE_NAMES[raw.primary_attr] ?? raw.primary_attr,
    roles: mapLaneRoles(raw.roles),
    image: raw.img ? `https://cdn.cloudflare.steamstatic.com${raw.img}` : null,
    winRate: raw.pub_pick > 0 ? round1((raw.pub_win / raw.pub_pick) * 100) : null,
    pickRate: totalPubMatches > 0 ? round1((raw.pub_pick / totalPubMatches) * 100) : null,
    banRate: totalProMatches > 0 ? round1((raw.pro_ban / totalProMatches) * 100) : null,
  };
}

// heroStats covers every hero in one call, so it backs both listHeroes and
// getHero. It changes at most a few times a day, so a 10 minute cache keeps
// requests fast without serving very stale data.
const HERO_STATS_TTL_MS = 10 * 60 * 1000;
const heroStatsCache = new AsyncCache<"all", Hero[]>(HERO_STATS_TTL_MS);

async function getAllHeroes(): Promise<Hero[]> {
  return heroStatsCache.get("all", async () => {
    const raw = await openDotaClient.getHeroStats();
    // pub_pick is a count of hero *picks*, i.e. 10 per match, so dividing by
    // 10 approximates the number of public matches in the sample.
    const totalPubMatches = raw.reduce((sum, h) => sum + h.pub_pick, 0) / 10;
    const totalProMatches = raw.reduce((sum, h) => sum + h.pro_pick, 0) / 10;
    return raw.map((h) => toHero(h, totalPubMatches, totalProMatches));
  });
}

export interface HeroFilters {
  role?: Role;
  attribute?: string;
  search?: string;
}

export async function listHeroes(filters: HeroFilters = {}): Promise<Hero[]> {
  const heroes = await getAllHeroes();
  const search = filters.search?.toLowerCase();
  return heroes
    .filter((h) => !filters.role || h.roles.includes(filters.role))
    .filter(
      (h) =>
        !filters.attribute || h.primaryAttribute.toLowerCase() === filters.attribute.toLowerCase(),
    )
    .filter(
      (h) =>
        !search ||
        h.name.toLowerCase().includes(search) ||
        h.shortName.toLowerCase().includes(search),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getHero(id: number): Promise<Hero | null> {
  const heroes = await getAllHeroes();
  return heroes.find((h) => h.id === id) ?? null;
}

function toHeroRef(
  id: number,
  heroes: Hero[],
): Pick<Hero, "id" | "name" | "shortName" | "image"> | null {
  const hero = heroes.find((h) => h.id === id);
  return hero
    ? { id: hero.id, name: hero.name, shortName: hero.shortName, image: hero.image }
    : null;
}

// Ignore matchups with too small a sample to be meaningful.
const MIN_MATCHUP_GAMES = 30;
const RELATIONSHIP_LIMIT = 10;

const matchupsCache = new AsyncCache<number, RawMatchup[]>(HERO_STATS_TTL_MS);

/** Heroes that beat `id` most often - i.e. the strongest picks *against* it. */
export async function getCounters(id: number): Promise<HeroRelationship[]> {
  const [matchups, heroes] = await Promise.all([
    matchupsCache.get(id, () => openDotaClient.getMatchups(id)),
    getAllHeroes(),
  ]);
  const heroName = heroes.find((h) => h.id === id)?.name ?? `hero ${id}`;

  return (
    matchups
      .filter((m) => m.games_played >= MIN_MATCHUP_GAMES)
      .map((m) => ({ heroId: m.hero_id, opponentWinRate: (m.wins / m.games_played) * 100 }))
      // Lowest win rate for `id` = the opponent it struggles against most = strongest counter.
      .sort((a, b) => a.opponentWinRate - b.opponentWinRate)
      .slice(0, RELATIONSHIP_LIMIT)
      .map(({ heroId, opponentWinRate }): HeroRelationship | null => {
        const ref = toHeroRef(heroId, heroes);
        if (!ref) return null;
        const counterStrength = round1(100 - opponentWinRate);
        return {
          hero: ref,
          score: counterStrength,
          reason: `Wins ~${counterStrength}% of matches against ${heroName}`,
        };
      })
      .filter((r): r is HeroRelationship => r !== null)
  );
}

// OpenDota's REST API has no "played together" endpoint, so synergy is
// computed with a raw SQL query against OpenDota's public /explorer
// endpoint, pairing teammates from the same match. This is slower (a few
// seconds) than the other endpoints, hence the same-length cache.
const SYNERGY_WINDOW_DAYS = 365;
const MIN_SYNERGY_GAMES = 20;

interface SynergyRow {
  hero_id: number;
  games: string | number;
  wins: string | number;
}

const synergyCache = new AsyncCache<number, SynergyRow[]>(HERO_STATS_TTL_MS);

function synergyQuery(heroId: number): string {
  // heroId always comes from a zod-validated positive-int route param before
  // reaching this function, but guard again since it is interpolated into
  // raw SQL text (the /explorer endpoint has no parameter binding).
  if (!Number.isInteger(heroId) || heroId <= 0) throw new Error("Invalid hero id.");
  return `
    SELECT pm2.hero_id, COUNT(*) AS games,
      SUM(CASE WHEN ((pm1.player_slot < 128) = m.radiant_win) THEN 1 ELSE 0 END) AS wins
    FROM player_matches pm1
    JOIN player_matches pm2
      ON pm1.match_id = pm2.match_id
      AND pm1.player_slot <> pm2.player_slot
      AND (pm1.player_slot < 128) = (pm2.player_slot < 128)
    JOIN matches m ON m.match_id = pm1.match_id
    WHERE pm1.hero_id = ${heroId}
      AND pm2.hero_id <> ${heroId}
      AND m.start_time > extract(epoch FROM now() - interval '${SYNERGY_WINDOW_DAYS} days')::int
    GROUP BY pm2.hero_id
    ORDER BY games DESC
    LIMIT 30
  `;
}

/** Heroes that win most often on the same team as `id`. */
export async function getSynergies(id: number): Promise<HeroRelationship[]> {
  const [rows, heroes] = await Promise.all([
    synergyCache.get(
      id,
      async () => (await openDotaClient.explorer<SynergyRow>(synergyQuery(id))).rows,
    ),
    getAllHeroes(),
  ]);
  const heroName = heroes.find((h) => h.id === id)?.name ?? `hero ${id}`;

  return rows
    .map((r) => ({ heroId: r.hero_id, games: Number(r.games), wins: Number(r.wins) }))
    .filter((r) => r.games >= MIN_SYNERGY_GAMES)
    .map((r) => ({ ...r, winRate: (r.wins / r.games) * 100 }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, RELATIONSHIP_LIMIT)
    .map(({ heroId, winRate }): HeroRelationship | null => {
      const ref = toHeroRef(heroId, heroes);
      if (!ref) return null;
      const score = round1(winRate);
      return {
        hero: ref,
        score,
        reason: `Wins ~${score}% of matches played alongside ${heroName}`,
      };
    })
    .filter((r): r is HeroRelationship => r !== null);
}

// The current patch changes on the order of months, so it's fine to cache
// for the process lifetime (refreshed hourly in case a request is served
// right around a patch release).
const PATCH_TTL_MS = 60 * 60 * 1000;
const patchCache = new AsyncCache<"current", string>(PATCH_TTL_MS);

async function getCurrentPatch(): Promise<string> {
  return patchCache.get("current", async () => {
    const patches = await openDotaClient.getPatches();
    return patches.at(-1)?.name ?? "unknown";
  });
}

export interface MetaSnapshot {
  patch: string;
  heroes: Hero[];
  topHeroes: Hero[];
}

export async function getMeta(role?: Role): Promise<MetaSnapshot> {
  const [heroes, patch] = await Promise.all([listHeroes({ role }), getCurrentPatch()]);
  return {
    patch,
    heroes: [...heroes].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0)),
    topHeroes: [...heroes].sort((a, b) => (b.pickRate ?? 0) - (a.pickRate ?? 0)).slice(0, 10),
  };
}
