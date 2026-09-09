import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as heroes from "../services/heroService.js";
import { getHeroMatches } from "../services/heroMatchService.js";
import { getHeroBuild } from "../services/heroBuildService.js";
import { OpenDotaError } from "../services/openDotaClient.js";
const role = z.enum(["carry", "mid", "offlane", "support", "hard-support"]);

/** Rethrows an OpenDota failure as a feature-specific, client-safe error. */
function asFeatureError(error: unknown, code: string, message: string): never {
  if (error instanceof OpenDotaError)
    throw Object.assign(new Error(message), { code, status: 502 });
  throw error;
}
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = z
      .object({
        role: role.optional(),
        attribute: z.string().max(30).optional(),
        search: z.string().max(80).optional(),
      })
      .parse(req.query);
    res.json({ data: await heroes.listHeroes(query) });
  } catch (error) {
    next(error);
  }
}
export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const hero = await heroes.getHero(id);
    if (!hero)
      return res
        .status(404)
        .json({ error: { code: "HERO_NOT_FOUND", message: "Hero not found." } });
    // Counters are a fast REST lookup; synergies hit OpenDota's /explorer SQL
    // endpoint, which is slower and occasionally times out upstream. Settle
    // both independently so a flaky synergy query degrades to an empty list
    // instead of failing the whole hero page.
    const [counters, synergies] = await Promise.allSettled([
      heroes.getCounters(id),
      heroes.getSynergies(id),
    ]);
    if (synergies.status === "rejected") console.error(synergies.reason);
    res.json({
      data: {
        ...hero,
        counters: counters.status === "fulfilled" ? counters.value : [],
        synergies: synergies.status === "fulfilled" ? synergies.value : [],
      },
    });
  } catch (error) {
    next(error);
  }
}
export async function counters(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      data: await heroes.getCounters(z.coerce.number().int().positive().parse(req.params.id)),
    });
  } catch (error) {
    next(error);
  }
}
export async function synergies(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      data: await heroes.getSynergies(z.coerce.number().int().positive().parse(req.params.id)),
    });
  } catch (error) {
    next(error);
  }
}
export async function matches(req: Request, res: Response, next: NextFunction) {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { limit, offset } = z
      .object({
        limit: z.coerce.number().int().min(1).max(50).optional(),
        offset: z.coerce.number().int().min(0).optional(),
      })
      .parse(req.query);
    const hero = await heroes.getHero(id);
    if (!hero)
      return res
        .status(404)
        .json({ error: { code: "HERO_NOT_FOUND", message: "Hero not found." } });
    try {
      res.json({ data: await getHeroMatches(id, { limit, offset }) });
    } catch (error) {
      asFeatureError(error, "HERO_MATCHES_FAILED", "Unable to load recent matches for this hero.");
    }
  } catch (error) {
    next(error);
  }
}
export async function builds(req: Request, res: Response, next: NextFunction) {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const hero = await heroes.getHero(id);
    if (!hero)
      return res
        .status(404)
        .json({ error: { code: "HERO_NOT_FOUND", message: "Hero not found." } });
    try {
      res.json({ data: await getHeroBuild(id) });
    } catch (error) {
      asFeatureError(error, "HERO_BUILDS_FAILED", "Unable to load suggested builds for this hero.");
    }
  } catch (error) {
    next(error);
  }
}
