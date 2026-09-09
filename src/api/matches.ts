import { request } from "./client";
import type { HeroMatchDetail, HeroMatchPage } from "./types";
export const getHeroMatches = (heroId: number, opts: { limit?: number; offset?: number } = {}) => {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.offset !== undefined) params.set("offset", String(opts.offset));
  const query = params.toString();
  return request<HeroMatchPage>(`/heroes/${heroId}/matches${query ? `?${query}` : ""}`);
};
export const getHeroMatchDetail = (heroId: number, matchId: number) =>
  request<HeroMatchDetail>(`/heroes/${heroId}/matches/${matchId}`);
