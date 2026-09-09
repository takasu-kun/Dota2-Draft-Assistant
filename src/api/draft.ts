import { request } from "./client";
import type { DraftAnalysis, Role } from "./types";
export const analyzeDraft = (body: { yourTeam: number[]; enemyTeam: number[]; role: Role }) =>
  request<DraftAnalysis>("/draft/analyze", { method: "POST", body: JSON.stringify(body) });
