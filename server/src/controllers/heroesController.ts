import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as heroes from "../services/heroService.js";
const role = z.enum(["carry", "mid", "offlane", "support", "hard-support"]);
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
    res.json({
      data: {
        ...hero,
        counters: await heroes.getCounters(id),
        synergies: await heroes.getSynergies(id),
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
