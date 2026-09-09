import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { analyzeDraft } from "../services/draftAnalysisService.js";
const schema = z
  .object({
    yourTeam: z.array(z.number().int().positive()).min(1).max(5),
    enemyTeam: z.array(z.number().int().positive()).min(1).max(5),
    role: z.enum(["carry", "mid", "offlane", "support", "hard-support"]),
  })
  .superRefine((value, ctx) => {
    const ids = [...value.yourTeam, ...value.enemyTeam];
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate heroes are not allowed." });
  });
export async function analyze(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ data: await analyzeDraft(schema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
}
