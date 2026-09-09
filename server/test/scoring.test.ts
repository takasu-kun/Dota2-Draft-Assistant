import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeFinalScore, computeMetaScore, SCORING_WEIGHTS } from "../src/services/scoring.js";

describe("SCORING_WEIGHTS", () => {
  test("sums to 1 (a documented invariant of the model)", () => {
    const sum =
      SCORING_WEIGHTS.counter +
      SCORING_WEIGHTS.synergy +
      SCORING_WEIGHTS.roleFit +
      SCORING_WEIGHTS.meta;
    assert.equal(sum, 1);
  });
});

describe("computeFinalScore", () => {
  test("matches the exact weighted calculation for a worked example", () => {
    // Counter=90, Synergy=80, RoleFit=90, Meta=70
    // 90*0.4 + 80*0.3 + 90*0.15 + 70*0.15 = 36 + 24 + 13.5 + 10.5 = 84
    const score = computeFinalScore({ counter: 90, synergy: 80, roleFit: 90, meta: 70 });
    assert.equal(score, 84);
  });

  test("all-zero breakdown scores 0, all-100 scores 100", () => {
    assert.equal(computeFinalScore({ counter: 0, synergy: 0, roleFit: 0, meta: 0 }), 0);
    assert.equal(computeFinalScore({ counter: 100, synergy: 100, roleFit: 100, meta: 100 }), 100);
  });

  test("counter contributes the most to the final score, meta the least alongside role fit", () => {
    const counterOnly = computeFinalScore({ counter: 100, synergy: 0, roleFit: 0, meta: 0 });
    const metaOnly = computeFinalScore({ counter: 0, synergy: 0, roleFit: 0, meta: 100 });
    assert.ok(counterOnly > metaOnly);
  });
});

describe("computeMetaScore", () => {
  test("a hero with a high win rate and high pick rate scores well above neutral", () => {
    const score = computeMetaScore({ winRate: 56, pickRate: 18 });
    assert.ok(score > 60, `expected a strong meta score, got ${score}`);
  });

  test("a hero with a low win rate and low pick rate scores below neutral", () => {
    const score = computeMetaScore({ winRate: 44, pickRate: 1 });
    assert.ok(score < 50, `expected a weak meta score, got ${score}`);
  });

  test("missing win rate and pick rate falls back to neutral (50), not a fabricated value", () => {
    assert.equal(computeMetaScore({ winRate: null, pickRate: null }), 50);
  });

  test("a hero with exactly baseline win rate and no pick rate data lands on neutral", () => {
    assert.equal(computeMetaScore({ winRate: 50, pickRate: null }), 50);
  });
});
