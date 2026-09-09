import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getMeta } from "../services/heroService.js";
const role = z.enum(["carry", "mid", "offlane", "support", "hard-support"]);
export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await getMeta(role.optional().parse(req.query.role)) });
  } catch (error) {
    next(error);
  }
}
