import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  categorizeByTime,
  extractFirstPurchasePerItem,
  resolveItem,
} from "../src/services/itemBuild.js";
import type { RawItemConstant, RawPurchaseLogEntry } from "../src/services/openDotaClient.js";

describe("categorizeByTime - deterministic, documented purchase-time thresholds", () => {
  test("at or before game start is starting", () => {
    assert.equal(categorizeByTime(-88), "starting");
    assert.equal(categorizeByTime(0), "starting");
  });
  test("up to 10 minutes is early", () => {
    assert.equal(categorizeByTime(1), "early");
    assert.equal(categorizeByTime(600), "early");
  });
  test("10 to 25 minutes is core", () => {
    assert.equal(categorizeByTime(601), "core");
    assert.equal(categorizeByTime(1500), "core");
  });
  test("past 25 minutes is situational", () => {
    assert.equal(categorizeByTime(1501), "situational");
    assert.equal(categorizeByTime(9999), "situational");
  });
});

function log(entries: [string, number][]): RawPurchaseLogEntry[] {
  return entries.map(([key, time]) => ({ key, time }));
}

describe("extractFirstPurchasePerItem", () => {
  test("keeps the earliest time when an item is bought more than once", () => {
    const result = extractFirstPurchasePerItem(
      log([
        ["tango", 500],
        ["tango", -88],
        ["tango", 900],
      ]),
    );
    assert.equal(result.get("tango"), -88);
  });
  test("drops recipe_ prefixed entries - they're a checkout artifact, not a build choice", () => {
    const result = extractFirstPurchasePerItem(
      log([
        ["recipe_blink", 100],
        ["blink", 100],
      ]),
    );
    assert.equal(result.has("recipe_blink"), false);
    assert.equal(result.has("blink"), true);
  });
  test("null/undefined log (unparsed match) returns an empty map, not an error", () => {
    assert.deepEqual(extractFirstPurchasePerItem(null), new Map());
    assert.deepEqual(extractFirstPurchasePerItem(undefined), new Map());
  });
  test("distinct items are all kept", () => {
    const result = extractFirstPurchasePerItem(
      log([
        ["tango", 0],
        ["blink", 1000],
      ]),
    );
    assert.deepEqual([...result.keys()].sort(), ["blink", "tango"]);
  });
});

describe("resolveItem", () => {
  const itemsByName: Record<string, RawItemConstant> = {
    tango: { id: 44, dname: "Tango", img: "/apps/dota2/images/dota_react/items/tango.png" },
    unnamed: { id: 999 },
  };
  test("resolves a known item's id/name/image", () => {
    const resolved = resolveItem("tango", itemsByName);
    assert.deepEqual(resolved, {
      itemId: 44,
      name: "Tango",
      image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/tango.png",
    });
  });
  test("falls back to the internal key when a known item has no display name", () => {
    assert.equal(resolveItem("unnamed", itemsByName)?.name, "unnamed");
  });
  test("returns null for an unknown key rather than throwing", () => {
    assert.equal(resolveItem("not_a_real_item", itemsByName), null);
  });
});
