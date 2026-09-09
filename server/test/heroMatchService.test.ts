import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  toHeroMatch,
  paginateMatches,
  type HeroMatchPage,
} from "../src/services/heroMatchService.js";
import type { RawHeroMatch } from "../src/services/openDotaClient.js";
import type { HeroMatch } from "../src/types/domain.js";

function rawMatch(overrides: Partial<RawHeroMatch> = {}): RawHeroMatch {
  return {
    match_id: 1,
    start_time: 1700000000,
    duration: 1800,
    radiant_win: true,
    player_slot: 0,
    leagueid: 1,
    league_name: "Test League",
    kills: 1,
    deaths: 2,
    assists: 3,
    ...overrides,
  };
}

describe("toHeroMatch - win/loss is from the selected hero's perspective, not the overall match winner", () => {
  test("hero on radiant, radiant wins -> win", () => {
    const m = toHeroMatch(rawMatch({ player_slot: 0, radiant_win: true }));
    assert.equal(m.win, true);
  });
  test("hero on radiant, radiant loses -> loss", () => {
    const m = toHeroMatch(rawMatch({ player_slot: 2, radiant_win: false }));
    assert.equal(m.win, false);
  });
  test("hero on dire, radiant wins -> loss", () => {
    const m = toHeroMatch(rawMatch({ player_slot: 128, radiant_win: true }));
    assert.equal(m.win, false);
  });
  test("hero on dire, radiant loses -> win", () => {
    const m = toHeroMatch(rawMatch({ player_slot: 131, radiant_win: false }));
    assert.equal(m.win, true);
  });
});

describe("toHeroMatch - field normalization", () => {
  test("maps every field to our own shape", () => {
    const m = toHeroMatch(
      rawMatch({
        match_id: 42,
        start_time: 123,
        duration: 900,
        kills: 5,
        deaths: 6,
        assists: 7,
        league_name: "  EPL Masters  ",
      }),
    );
    assert.deepEqual(m, {
      matchId: 42,
      startTime: 123,
      duration: 900,
      win: true,
      kills: 5,
      deaths: 6,
      assists: 7,
      leagueName: "EPL Masters",
    } satisfies HeroMatch);
  });
  test("blank/missing league name normalizes to null instead of an empty string", () => {
    assert.equal(toHeroMatch(rawMatch({ league_name: "   " })).leagueName, null);
    assert.equal(toHeroMatch(rawMatch({ league_name: null })).leagueName, null);
  });
});

describe("paginateMatches", () => {
  const all: HeroMatch[] = Array.from({ length: 25 }, (_, i) =>
    toHeroMatch(rawMatch({ match_id: i })),
  );

  test("returns a page and correct total/hasMore", () => {
    const page: HeroMatchPage = paginateMatches(all, { limit: 10, offset: 0 });
    assert.equal(page.matches.length, 10);
    assert.equal(page.total, 25);
    assert.equal(page.hasMore, true);
  });
  test("hasMore is false on the last page, exactly at the boundary", () => {
    const page = paginateMatches(all, { limit: 10, offset: 20 });
    assert.equal(page.matches.length, 5);
    assert.equal(page.hasMore, false);
  });
  test("offset past the end returns an empty page, not an error", () => {
    const page = paginateMatches(all, { limit: 10, offset: 100 });
    assert.deepEqual(page.matches, []);
    assert.equal(page.hasMore, false);
  });
  test("empty match list", () => {
    const page = paginateMatches([], { limit: 15, offset: 0 });
    assert.deepEqual(page, { matches: [], total: 0, hasMore: false });
  });
  test("defaults apply when limit/offset are omitted", () => {
    const page = paginateMatches(all);
    assert.equal(page.matches.length, 15);
  });
});
