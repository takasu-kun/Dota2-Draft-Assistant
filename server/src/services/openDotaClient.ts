/**
 * Thin HTTP client for the public OpenDota API (https://docs.opendota.com/).
 * No API key is required for the endpoints used here (free tier rate limits
 * apply: ~60 req/min, ~3000 req/day at the time of writing).
 *
 * This module only knows how to talk to OpenDota and shape its raw JSON into
 * typed responses - it has no opinion about our own domain model. That
 * mapping lives in `heroService.ts`.
 */
const BASE_URL = "https://api.opendota.com/api";

export class OpenDotaError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenDotaError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  searchParams?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new OpenDotaError(
      `OpenDota request to ${path} failed with ${response.status}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

/** One entry of `GET /heroStats` - hero metadata plus aggregate pick/win/ban counts. */
export interface RawHeroStat {
  id: number;
  name: string;
  localized_name: string;
  primary_attr: "str" | "agi" | "int" | "all";
  roles: string[];
  img: string | null;
  pub_pick: number;
  pub_win: number;
  pro_pick: number;
  pro_win: number;
  pro_ban: number;
}

/** One entry of `GET /heroes/{hero_id}/matchups` - results FOR hero_id against hero_id's opponent. */
export interface RawMatchup {
  hero_id: number;
  games_played: number;
  wins: number;
}

/** One entry of `GET /constants/patch`. */
export interface RawPatch {
  id: number;
  name: string;
  date: string;
}

/**
 * One entry of `GET /heroes/{hero_id}/matches`. This is pro/league match
 * data only (not public matchmaking) - OpenDota's public API has no
 * "recent pub matches for a hero" endpoint. There is no `hero_level` or
 * `game_mode` field on this endpoint despite both existing on OpenDota's
 * general match objects; only what's listed below is actually present.
 */
export interface RawHeroMatch {
  match_id: number;
  start_time: number;
  duration: number;
  radiant_win: boolean;
  player_slot: number;
  leagueid: number;
  league_name: string | null;
  kills: number;
  deaths: number;
  assists: number;
}

/**
 * One entry of `GET /constants/items`, an object keyed by the item's
 * internal name (e.g. "tango", "blink") - which is exactly the string
 * `purchase_log[].key` uses on `GET /matches/{match_id}`, so that raw
 * object is looked up directly by name rather than re-indexed by id.
 */
export interface RawItemConstant {
  id: number;
  dname?: string;
  img?: string;
  cost?: number | null;
}

/** One entry of `player.purchase_log` on `GET /matches/{match_id}`. */
export interface RawPurchaseLogEntry {
  /** Seconds relative to game start; negative/zero for pre-game purchases. */
  time: number;
  /** Internal item name - a key into `GET /constants/items`, not a numeric id. */
  key: string;
}

/** The subset of `GET /matches/{match_id}`'s per-player fields this app uses. */
export interface RawMatchPlayer {
  hero_id: number;
  player_slot: number;
  kills: number;
  deaths: number;
  assists: number;
  level: number | null;
  /** Absent on matches OpenDota hasn't replay-parsed yet. */
  purchase_log?: RawPurchaseLogEntry[] | null;
}

/** The subset of `GET /matches/{match_id}` this app uses. */
export interface RawMatchDetail {
  match_id: number;
  duration: number;
  radiant_win: boolean;
  players: RawMatchPlayer[];
}

/** A row shape returned by `GET /explorer?sql=...` (raw SQL over OpenDota's dataset). */
export interface ExplorerResponse<T> {
  rows: T[];
}

export const openDotaClient = {
  getHeroStats: () => request<RawHeroStat[]>("/heroStats"),
  getMatchups: (heroId: number) => request<RawMatchup[]>(`/heroes/${heroId}/matchups`),
  getPatches: () => request<RawPatch[]>("/constants/patch"),
  getHeroMatches: (heroId: number) => request<RawHeroMatch[]>(`/heroes/${heroId}/matches`),
  getMatchDetail: (matchId: number) => request<RawMatchDetail>(`/matches/${matchId}`),
  getItemConstants: () => request<Record<string, RawItemConstant>>("/constants/items"),
  explorer: <T>(sql: string) => request<ExplorerResponse<T>>("/explorer", { sql }),
};
