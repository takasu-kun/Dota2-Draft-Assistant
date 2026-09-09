import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { app } from "../src/app.js";

// These hit the real OpenDota API for the hero catalog lookup (a fast,
// cached call) to verify our own validation/not-found handling; they don't
// exercise the matches/builds OpenDota calls themselves since both routes
// return before reaching those for an invalid/unknown hero id.
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

const UNKNOWN_HERO_ID = 999999999;

describe("GET /api/heroes/:id/matches", () => {
  test("non-numeric id is a validation error, not a 500", async () => {
    const res = await fetch(`${baseUrl}/api/heroes/not-a-number/matches`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, "VALIDATION_ERROR");
  });
  test("unknown (but well-formed) hero id is 404 HERO_NOT_FOUND", async () => {
    const res = await fetch(`${baseUrl}/api/heroes/${UNKNOWN_HERO_ID}/matches`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, "HERO_NOT_FOUND");
  });
  test("out-of-range limit is rejected rather than silently clamped or passed through", async () => {
    const res = await fetch(`${baseUrl}/api/heroes/1/matches?limit=999`);
    assert.equal(res.status, 400);
  });
});

describe("GET /api/heroes/:id/matches/:matchId", () => {
  // A real, known pro match for Lion (hero 26) - match history is
  // immutable once played, so this stays valid indefinitely.
  const LION_ID = 26;
  const LION_MATCH_ID = 8990366825;

  test("non-numeric ids are validation errors, not a 500", async () => {
    const res = await fetch(`${baseUrl}/api/heroes/${LION_ID}/matches/not-a-number`);
    assert.equal(res.status, 400);
  });
  test("unknown hero id is 404 HERO_NOT_FOUND", async () => {
    const res = await fetch(`${baseUrl}/api/heroes/${UNKNOWN_HERO_ID}/matches/${LION_MATCH_ID}`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, "HERO_NOT_FOUND");
  });
  test("nonexistent match id is 404 MATCH_NOT_FOUND", async () => {
    const res = await fetch(`${baseUrl}/api/heroes/${LION_ID}/matches/1`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, "MATCH_NOT_FOUND");
  });
  test("a real match that hero didn't play in is 404 HERO_NOT_IN_MATCH", async () => {
    const res = await fetch(`${baseUrl}/api/heroes/1/matches/${LION_MATCH_ID}`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, "HERO_NOT_IN_MATCH");
  });
  test("a real hero+match combination returns the item timeline, win/loss, and level", async () => {
    const res = await fetch(`${baseUrl}/api/heroes/${LION_ID}/matches/${LION_MATCH_ID}`);
    assert.equal(res.status, 200);
    const { data } = await res.json();
    assert.equal(data.matchId, LION_MATCH_ID);
    assert.equal(data.heroId, LION_ID);
    assert.equal(typeof data.win, "boolean");
    assert.equal(typeof data.heroLevel, "number");
    assert.ok(Array.isArray(data.items) && data.items.length > 0);
    assert.ok(
      data.items.every(
        (i: { itemId: number; name: string }) =>
          typeof i.itemId === "number" && typeof i.name === "string",
      ),
    );
  });
});

describe("GET /api/heroes/:id/builds", () => {
  test("non-numeric id is a validation error, not a 500", async () => {
    const res = await fetch(`${baseUrl}/api/heroes/not-a-number/builds`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, "VALIDATION_ERROR");
  });
  test("unknown (but well-formed) hero id is 404 HERO_NOT_FOUND", async () => {
    const res = await fetch(`${baseUrl}/api/heroes/${UNKNOWN_HERO_ID}/builds`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, "HERO_NOT_FOUND");
  });
});
