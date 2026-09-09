import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { app } from "../src/app.js";
import { SCORING_WEIGHTS } from "../src/services/scoring.js";

let baseUrl: string;
let server: ReturnType<typeof app.listen>;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});
after(() => new Promise((resolve) => server.close(resolve)));

function analyze(body: unknown) {
  return fetch(`${baseUrl}/api/draft/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/draft/analyze - validation", () => {
  test("invalid role is rejected", async () => {
    const res = await analyze({ yourTeam: [1], enemyTeam: [2], role: "jungler" });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, "VALIDATION_ERROR");
  });
  test("duplicate hero across teams is rejected", async () => {
    const res = await analyze({ yourTeam: [1], enemyTeam: [1], role: "carry" });
    assert.equal(res.status, 400);
  });
  test("an empty team is rejected", async () => {
    const res = await analyze({ yourTeam: [], enemyTeam: [1], role: "carry" });
    assert.equal(res.status, 400);
  });
  test("more than 5 heroes on a team is rejected", async () => {
    const res = await analyze({ yourTeam: [1, 2, 3, 4, 5, 6], enemyTeam: [7], role: "carry" });
    assert.equal(res.status, 400);
  });
  test("an unknown hero id is 404 HERO_NOT_FOUND", async () => {
    const res = await analyze({ yourTeam: [999999999], enemyTeam: [1], role: "carry" });
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, "HERO_NOT_FOUND");
  });
});

describe("POST /api/draft/analyze - partial draft, real recommendations", () => {
  test("a 1v1 partial draft returns ranked, fully-scored recommendations excluding picked heroes", async () => {
    const yourTeam = [1]; // Anti-Mage
    const enemyTeam = [63]; // Weaver
    const res = await analyze({ yourTeam, enemyTeam, role: "support" });
    assert.equal(res.status, 200);
    const { data } = await res.json();

    assert.equal(typeof data.draftScore, "number");
    assert.ok(Array.isArray(data.recommendations) && data.recommendations.length > 0);

    for (const rec of data.recommendations) {
      // Candidate filtering: never recommend an already-picked hero.
      assert.ok(![...yourTeam, ...enemyTeam].includes(rec.hero.id));

      // Every breakdown component is a real 0-100 number.
      for (const key of ["counter", "synergy", "roleFit", "meta"] as const) {
        assert.equal(typeof rec.breakdown[key], "number");
        assert.ok(rec.breakdown[key] >= 0 && rec.breakdown[key] <= 100);
      }

      // The final score is exactly the documented weighted combination.
      const expected = Math.round(
        rec.breakdown.counter * SCORING_WEIGHTS.counter +
          rec.breakdown.synergy * SCORING_WEIGHTS.synergy +
          rec.breakdown.roleFit * SCORING_WEIGHTS.roleFit +
          rec.breakdown.meta * SCORING_WEIGHTS.meta,
      );
      assert.equal(rec.score, expected);
    }

    // Ranked descending by score.
    const scores = data.recommendations.map((r: { score: number }) => r.score);
    assert.deepEqual(
      scores,
      [...scores].sort((a, b) => b - a),
    );
  });
});
