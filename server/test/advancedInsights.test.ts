import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildAdvancedInsights,
  computeDimensionScores,
  computePhaseScore,
  classifyPowerWindow,
  PHASE_DIMENSION_WEIGHTS,
} from "../src/services/advancedInsights.js";
import type { Hero } from "../src/types/domain.js";

function hero(id: number, name: string, roles: Hero["roles"] = ["carry"]): Hero {
  return {
    id,
    name,
    shortName: name.toLowerCase(),
    primaryAttribute: "strength",
    roles,
    image: null,
    winRate: 50,
    pickRate: 10,
    banRate: 5,
  };
}

describe("PHASE_DIMENSION_WEIGHTS", () => {
  test("each phase's weights sum to 1 (a documented invariant of the model)", () => {
    for (const phase of ["early", "mid", "late"] as const) {
      const sum = Object.values(PHASE_DIMENSION_WEIGHTS[phase]).reduce((a, b) => a + (b ?? 0), 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `${phase} weights sum to ${sum}, expected 1`);
    }
  });
});

describe("computeDimensionScores", () => {
  test("an empty team returns neutral (50) scores for every dimension, never crashes", () => {
    const scores = computeDimensionScores([], new Map());
    for (const value of Object.values(scores)) assert.equal(value, 50);
  });

  test("a hero with no matching tags contributes nothing (dimensions stay low, not fabricated)", () => {
    const h = hero(1, "Nobody");
    const scores = computeDimensionScores([h], new Map([[1, ["SomeUnknownTag"]]]));
    for (const value of Object.values(scores)) assert.equal(value, 0);
  });

  test("a heavy-Carry team scores high on scaling/farming and low elsewhere", () => {
    const heroes = [hero(1, "A"), hero(2, "B")];
    const tags = new Map([
      [1, ["Carry", "Escape"]],
      [2, ["Carry", "Jungler"]],
    ]);
    const scores = computeDimensionScores(heroes, tags);
    assert.ok(scores.scaling > 50, `expected high scaling, got ${scores.scaling}`);
    assert.ok(scores.farming > 30, `expected some farming signal, got ${scores.farming}`);
    assert.equal(scores.teamfight, 0);
  });

  test("partial drafts (1 hero) are not diluted by team size", () => {
    const oneHero = computeDimensionScores([hero(1, "A")], new Map([[1, ["Carry"]]]));
    const twoHeroesSameTag = computeDimensionScores(
      [hero(1, "A"), hero(2, "B")],
      new Map([
        [1, ["Carry"]],
        [2, ["Carry"]],
      ]),
    );
    // Averaging per hero (not summing) means identical composition "lean"
    // regardless of how many heroes are drafted so far.
    assert.equal(oneHero.scaling, twoHeroesSameTag.scaling);
  });
});

describe("computePhaseScore / classifyPowerWindow", () => {
  test("all-neutral dimensions produce a neutral phase score classified as Moderate", () => {
    const neutral = computeDimensionScores([], new Map());
    for (const phase of ["early", "mid", "late"] as const) {
      const score = computePhaseScore(neutral, phase);
      assert.equal(score, 50);
      assert.equal(classifyPowerWindow(score), "Moderate");
    }
  });

  test("a dominant scaling composition classifies as Strong for the late phase", () => {
    const heroes = [hero(1, "A"), hero(2, "B"), hero(3, "C")];
    const tags = new Map([
      [1, ["Carry"]],
      [2, ["Carry", "Durable"]],
      [3, ["Carry", "Durable"]],
    ]);
    const dims = computeDimensionScores(heroes, tags);
    const lateScore = computePhaseScore(dims, "late");
    assert.equal(classifyPowerWindow(lateScore), "Strong");
  });
});

describe("buildAdvancedInsights", () => {
  const yourHeroes = [hero(1, "Initiator1"), hero(2, "Disabler1")];
  const enemyHeroes = [hero(3, "Carry1")];
  const rawTagsById = new Map([
    [1, ["Initiator", "Durable"]],
    [2, ["Disabler", "Nuker"]],
    [3, ["Carry", "Escape"]],
  ]);

  test("produces all three phases with the documented shape", () => {
    const insights = buildAdvancedInsights(yourHeroes, enemyHeroes, rawTagsById);
    for (const phase of ["early", "mid", "late"] as const) {
      const p = insights[phase];
      assert.equal(p.phase, phase);
      assert.ok(["your", "enemy", "even"].includes(p.advantage));
      assert.ok(["high", "medium", "low"].includes(p.confidence));
      assert.ok(p.yourTeam.gamePlan.length > 0);
      assert.ok(p.enemyTeam.gamePlan.length > 0);
      assert.ok(Array.isArray(p.yourTeam.priorities) && p.yourTeam.priorities.length > 0);
      assert.ok(Array.isArray(p.yourTeam.avoid) && p.yourTeam.avoid.length > 0);
    }
    assert.ok(insights.yourWinCondition.length > 0);
    assert.ok(insights.enemyWinCondition.length > 0);
  });

  test("the enemy team's copy is written from the enemy's perspective, never addressing the reader as 'your'", () => {
    const insights = buildAdvancedInsights(yourHeroes, enemyHeroes, rawTagsById);
    for (const phase of ["early", "mid", "late"] as const) {
      const enemy = insights[phase].enemyTeam;
      const allText = [enemy.gamePlan, ...enemy.priorities, ...enemy.avoid].join(" ").toLowerCase();
      assert.ok(
        !allText.includes("your"),
        `enemy team copy should never say "your" (phase=${phase}): ${allText}`,
      );
    }
    assert.ok(!insights.enemyWinCondition.toLowerCase().includes(" your "));
  });

  test("a team leaning heavily into teamfight/control gets the mid-game advantage over a lone Carry", () => {
    const insights = buildAdvancedInsights(yourHeroes, enemyHeroes, rawTagsById);
    assert.equal(insights.mid.advantage, "your");
  });

  test("is deterministic: identical input produces identical output", () => {
    const a = buildAdvancedInsights(yourHeroes, enemyHeroes, rawTagsById);
    const b = buildAdvancedInsights(yourHeroes, enemyHeroes, rawTagsById);
    assert.deepEqual(a, b);
  });

  test("missing tag data for every hero still returns a full, non-crashing result at low confidence", () => {
    const insights = buildAdvancedInsights(yourHeroes, enemyHeroes, new Map());
    assert.equal(insights.early.confidence, "low");
    assert.equal(insights.mid.advantage, "even");
  });

  test("a single-hero draft on each side still produces a full result", () => {
    const insights = buildAdvancedInsights([hero(1, "A")], [hero(2, "B")], new Map());
    assert.ok(insights.early.yourTeam.gamePlan.length > 0);
  });
});
