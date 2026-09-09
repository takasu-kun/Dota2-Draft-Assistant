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
