import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  scoreFromPositionData,
  scoreFromTags,
  getRolePerformance,
  type PositionBucket,
} from "../src/services/roleFitService.js";

function bucket(overrides: Partial<PositionBucket>): PositionBucket {
  return { laneRole: 1, roaming: false, games: 0, wins: 0, ...overrides };
}

describe("scoreFromPositionData - strong vs weak fit", () => {
  test("a hero played and winning constantly in the requested position scores high", () => {
    const buckets = [bucket({ laneRole: 1, roaming: false, games: 1000, wins: 650 })];
    const score = scoreFromPositionData(buckets, "carry");
    assert.ok(score !== null && score >= 80, `expected a high score, got ${score}`);
  });

  test("a hero with real data but never played in the requested position scores 0, not neutral", () => {
    // Real data exists for this hero (it has position data overall) - it's
    // just never played this way, which is itself informative and distinct
    // from "we have no data on this hero at all".
    const buckets = [bucket({ laneRole: 1, roaming: false, games: 500, wins: 250 })];
    assert.equal(scoreFromPositionData(buckets, "mid"), 0);
  });

  test("no position data at all returns null (caller falls back to tags/neutral)", () => {
    assert.equal(scoreFromPositionData([], "carry"), null);
  });
});

describe("scoreFromPositionData - sample size vs raw win rate", () => {
  test("a tiny high-win-rate sample does not outscore a large, reliable, lower-win-rate sample", () => {
    const tinyHighWinRate = scoreFromPositionData(
      [bucket({ laneRole: 2, roaming: false, games: 3, wins: 3 })], // 100% of 3 games
      "mid",
    );
    const largeReliable = scoreFromPositionData(
      [bucket({ laneRole: 2, roaming: false, games: 5000, wins: 2750 })], // 55% of 5000 games
      "mid",
    );
    assert.ok(tinyHighWinRate !== null && largeReliable !== null);
    assert.ok(
      largeReliable > tinyHighWinRate,
      `expected the large reliable sample (${largeReliable}) to outscore the tiny one (${tinyHighWinRate})`,
    );
  });
});

describe("scoreFromPositionData - support/hard support share the same evidence", () => {
  test("OpenDota's data can't distinguish position 4 from 5, so both read identically", () => {
    const buckets = [
      bucket({ laneRole: 3, roaming: true, games: 400, wins: 210 }),
      bucket({ laneRole: 2, roaming: true, games: 50, wins: 20 }),
    ];
    assert.equal(
      scoreFromPositionData(buckets, "support"),
      scoreFromPositionData(buckets, "hard-support"),
    );
  });

  test("aggregates multiple roaming buckets (e.g. roaming from both off lane and mid)", () => {
    const buckets = [
      bucket({ laneRole: 3, roaming: true, games: 300, wins: 150 }),
      bucket({ laneRole: 2, roaming: true, games: 300, wins: 150 }),
      bucket({ laneRole: 1, roaming: false, games: 1000, wins: 900 }), // not roaming - excluded from support evidence
    ];
    const score = scoreFromPositionData(buckets, "support");
    // Prevalence should reflect only the 600 roaming games out of 1600 total, not all 1900.
    assert.ok(
      score !== null && score < 60,
      `expected prevalence to be diluted by the large non-support sample, got ${score}`,
    );
  });
});

describe("getRolePerformance - raw display win rate, no shrinkage/amplification", () => {
  test("computes the exact real win rate for the requested position", () => {
    const buckets = [bucket({ laneRole: 1, roaming: false, games: 300, wins: 165 })]; // 55%
    assert.deepEqual(getRolePerformance(buckets, "carry"), { winRate: 55, games: 300 });
  });
  test("a 100%-of-3-games sample reports the real (unshrunk) 100%, unlike the fit score", () => {
    // getRolePerformance is for honest display, so it must NOT apply
    // scoreFromPositionData's sample-size shrinkage - that's a scoring
    // concern, not a "what actually happened" concern.
    const buckets = [bucket({ laneRole: 2, roaming: false, games: 3, wins: 3 })];
    assert.deepEqual(getRolePerformance(buckets, "mid"), { winRate: 100, games: 3 });
  });
  test("no games in the requested position returns null win rate and 0 games", () => {
    const buckets = [bucket({ laneRole: 1, roaming: false, games: 500, wins: 250 })];
    assert.deepEqual(getRolePerformance(buckets, "mid"), { winRate: null, games: 0 });
  });
  test("no position data at all returns null win rate and 0 games, not an error", () => {
    assert.deepEqual(getRolePerformance([], "carry"), { winRate: null, games: 0 });
  });
});

describe("scoreFromTags - fallback tier only", () => {
  test("a hero tagged for the requested role scores above neutral", () => {
    assert.ok(scoreFromTags(["Support", "Disabler"], "support") > 50);
  });
  test("a hero not tagged for the requested role scores below neutral, not zero", () => {
    const score = scoreFromTags(["Carry", "Escape"], "support");
    assert.ok(score < 50 && score > 0);
  });
  test("no tags at all still returns a defined, documented fallback score", () => {
    assert.equal(typeof scoreFromTags([], "carry"), "number");
  });
});
