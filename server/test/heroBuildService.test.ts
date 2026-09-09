import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildItemsFromCounts, tallyByCategory } from "../src/services/heroBuildService.js";
import type { RawItemConstant } from "../src/services/openDotaClient.js";

function itemsByName(
  items: Record<string, Partial<RawItemConstant>>,
): Record<string, RawItemConstant> {
  return Object.fromEntries(Object.entries(items).map(([key, item]) => [key, { id: 0, ...item }]));
}

describe("buildItemsFromCounts", () => {
  test("sorts by count descending and computes percentage as count/sampleSize", () => {
    const items = buildItemsFromCounts(
      new Map([
        ["a", 5],
        ["b", 10],
        ["c", 2],
      ]),
      10,
      itemsByName({ a: { dname: "A", id: 1 }, b: { dname: "B", id: 2 }, c: { dname: "C", id: 3 } }),
    );
    assert.deepEqual(
      items.map((i) => [i.name, i.count, i.percentage]),
      [
        ["B", 10, 100],
        ["A", 5, 50],
        ["C", 2, 20],
      ],
    );
  });

  test("percentage is relative to the analyzed sample, not the top item in the category", () => {
    // Unlike a "relative to the category leader" scheme, an item bought in
    // half the analyzed matches should read 50%, even if it's the top item.
    const items = buildItemsFromCounts(new Map([["a", 5]]), 10, {});
    assert.equal(items[0].percentage, 50);
  });

  test("zero sample size doesn't divide by zero", () => {
    const items = buildItemsFromCounts(new Map([["a", 0]]), 0, {});
    assert.equal(items[0].percentage, 0);
  });

  test("caps at 8 items", () => {
    const counts = new Map(Array.from({ length: 20 }, (_, i) => [`item${i}`, i + 1] as const));
    assert.equal(buildItemsFromCounts(counts, 20, {}).length, 8);
  });

  test("falls back to a generic name/null image for items missing from the constants map", () => {
    const items = buildItemsFromCounts(new Map([["mystery_item", 3]]), 10, {});
    assert.equal(items[0].name, "mystery_item");
    assert.equal(items[0].image, null);
    assert.equal(items[0].itemId, -1);
  });

  test("empty counts returns an empty list, not an error", () => {
    assert.deepEqual(buildItemsFromCounts(new Map(), 10, {}), []);
  });
});

describe("tallyByCategory", () => {
  test("counts a match once per item regardless of when within a category it was bought", () => {
    const perMatch = [
      new Map([
        ["tango", -88],
        ["blink", 1000],
      ]),
      new Map([["tango", -50]]),
    ];
    const tally = tallyByCategory(perMatch);
    assert.equal(tally.starting.get("tango"), 2);
    assert.equal(tally.core.get("blink"), 1);
  });

  test("routes items into starting/early/core/situational by purchase time", () => {
    const tally = tallyByCategory([
      new Map([
        ["a", 0], // starting
        ["b", 300], // early
        ["c", 1000], // core
        ["d", 2000], // situational
      ]),
    ]);
    assert.equal(tally.starting.has("a"), true);
    assert.equal(tally.early.has("b"), true);
    assert.equal(tally.core.has("c"), true);
    assert.equal(tally.situational.has("d"), true);
  });

  test("no analyzed matches produces empty tallies for every category, not an error", () => {
    const tally = tallyByCategory([]);
    assert.equal(tally.starting.size, 0);
    assert.equal(tally.early.size, 0);
    assert.equal(tally.core.size, 0);
    assert.equal(tally.situational.size, 0);
  });
});
