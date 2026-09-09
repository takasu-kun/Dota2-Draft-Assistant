export type Role = "carry" | "mid" | "offlane" | "support" | "hard-support";
export interface Hero {
  id: number;
  name: string;
  shortName: string;
  primaryAttribute: string;
  roles: Role[];
  image: string | null;
  winRate: number | null;
  pickRate: number | null;
  banRate: number | null;
}
export interface HeroRelationship {
  hero: Pick<Hero, "id" | "name" | "shortName" | "image">;
  score: number;
  reason: string | null;
}
export interface DraftRecommendation {
  hero: Hero;
  score: number;
  reasons: string[];
}
export interface DraftAnalysis {
  draftScore: number;
  strengths: string[];
  weaknesses: string[];
  priorities: { priority: "high" | "medium" | "low"; name: string }[];
  recommendations: DraftRecommendation[];
}

export interface HeroMatch {
  matchId: number;
  startTime: number;
  duration: number;
  /** From the selected hero's perspective, not the overall match winner. */
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  leagueName: string | null;
}

export interface BuildItem {
  itemId: number;
  name: string;
  image: string | null;
  count: number;
  /** Relative to the most-purchased item in this same category. */
  percentage: number;
}

export interface HeroBuild {
  heroId: number;
  /** Best-effort proxy for match sample size (see heroBuildService.ts) - not exact. */
  sampleSize: number;
  lowConfidence: boolean;
  startingItems: BuildItem[];
  earlyItems: BuildItem[];
  coreItems: BuildItem[];
  situationalItems: BuildItem[];
}
