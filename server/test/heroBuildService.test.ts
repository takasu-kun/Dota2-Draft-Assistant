import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toBuildItems, summarizeHeroBuild } from "../src/services/heroBuildService.js";
import type { RawItemConstant, RawItemPopularity } from "../src/services/openDotaClient.js";

function itemsById(items: Record<number, Partial<RawItemConstant>>): Map<number, RawItemConstant> {
  return new Map(
    Object.entries(items).map(([id, item]) => [Number(id), { id: Number(id), ...item }]),
  );
}

describe("toBuildItems", () => {
  test("sorts by count descending and computes percentage relative to the top item", () => {
    const items = toBuildItems(
      { "1": 50, "2": 100, "3": 25 },
      itemsById({ 1: { dname: "A" }, 2: { dname: "B" }, 3: { dname: "C" } }),
    );
    assert.deepEqual(
      items.map((i) => [i.name, i.count, i.percentage]),
      [
        ["B", 100, 100],
        ["A", 50, 50],
        ["C", 25, 25],
      ],
    );
  });

  test("caps at 8 items per category", () => {
    const counts = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i + 1), i + 1]));
    const items = toBuildItems(counts, new Map());
    assert.equal(items.length, 8);
  });

  test("drops zero-count and non-numeric entries", () => {
    const items = toBuildItems(
      { "1": 10, "2": 0, notAnId: 5 } as unknown as Record<string, number>,
      new Map(),
    );
    assert.deepEqual(
      items.map((i) => i.itemId),
      [1],
    );
  });

  test("falls back to a generic name/null image for items missing from the constants map", () => {
    const items = toBuildItems({ "999": 10 }, new Map());
    assert.equal(items[0].name, "Item 999");
    assert.equal(items[0].image, null);
  });

  test("builds a full CDN URL when item metadata has an image", () => {
    const items = toBuildItems(
      { "1": 10 },
      itemsById({ 1: { dname: "Tango", img: "/apps/dota2/x.png" } }),
    );
    assert.equal(items[0].image, "https://cdn.cloudflare.steamstatic.com/apps/dota2/x.png");
  });

  test("empty category returns an empty list, not an error", () => {
    assert.deepEqual(toBuildItems({}, new Map()), []);
  });
});

function popularity(overrides: Partial<RawItemPopularity> = {}): RawItemPopularity {
  return {
    start_game_items: {},
    early_game_items: {},
    mid_game_items: {},
    late_game_items: {},
    ...overrides,
  };
}

describe("summarizeHeroBuild", () => {
  test("sample size is the highest single-item count across all categories", () => {
    const build = summarizeHeroBuild(
      1,
      popularity({ start_game_items: { "1": 150 }, mid_game_items: { "2": 40 } }),
      new Map(),
    );
    assert.equal(build.sampleSize, 150);
  });

  test("flags low confidence below the threshold", () => {
    const build = summarizeHeroBuild(1, popularity({ start_game_items: { "1": 5 } }), new Map());
    assert.equal(build.lowConfidence, true);
  });

  test("does not flag low confidence at/above the threshold", () => {
    const build = summarizeHeroBuild(1, popularity({ start_game_items: { "1": 20 } }), new Map());
    assert.equal(build.lowConfidence, false);
  });

  test("a hero with no purchase data anywhere reports a zero sample and every category empty", () => {
    const build = summarizeHeroBuild(1, popularity(), new Map());
    assert.equal(build.sampleSize, 0);
    assert.equal(build.lowConfidence, true);
    assert.deepEqual(build.startingItems, []);
    assert.deepEqual(build.earlyItems, []);
    assert.deepEqual(build.coreItems, []);
    assert.deepEqual(build.situationalItems, []);
  });

  test("categories map start/early/mid/late to starting/early/core/situational", () => {
    const build = summarizeHeroBuild(
      1,
      popularity({
        start_game_items: { "1": 10 },
        early_game_items: { "2": 10 },
        mid_game_items: { "3": 10 },
        late_game_items: { "4": 10 },
      }),
      new Map(),
    );
    assert.equal(build.startingItems[0].itemId, 1);
    assert.equal(build.earlyItems[0].itemId, 2);
    assert.equal(build.coreItems[0].itemId, 3);
    assert.equal(build.situationalItems[0].itemId, 4);
  });
});
