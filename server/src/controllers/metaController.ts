import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getMeta } from "../services/heroService.js";
import { getRoleRankings } from "../services/roleFitService.js";
const role = z.enum(["carry", "mid", "offlane", "support", "hard-support"]);
export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await getMeta(role.optional().parse(req.query.role)) });
  } catch (error) {
    next(error);
  }
}
// Separate from the endpoint above on purpose: that one is cheap and backs
// the patch display on every page's topbar, this one is slow (real
// position-data lookups per role) and should only run when Meta Insights
// actually needs it.
export async function roleRankings(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await getRoleRankings() });
  } catch (error) {
    next(error);
  }
}
