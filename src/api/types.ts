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
export interface Meta {
  patch: string;
  heroes: Hero[];
  topHeroes: Hero[];
}
export interface RoleRanking {
  role: Role;
  hero: Hero | null;
  winRate: number | null;
  games: number;
}
export interface ScoreBreakdown {
  counter: number;
  synergy: number;
  roleFit: number;
  meta: number;
}
export interface DraftRecommendation {
  hero: Hero;
  score: number;
  breakdown: ScoreBreakdown;
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
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  leagueName: string | null;
}
export interface HeroMatchPage {
  matches: HeroMatch[];
  total: number;
  hasMore: boolean;
}

export type BuildCategory = "starting" | "early" | "core" | "situational";
export interface MatchItemPurchase {
  itemId: number;
  name: string;
  image: string | null;
  timestamp: number;
  category: BuildCategory;
}
export interface HeroMatchDetail {
  matchId: number;
  heroId: number;
  win: boolean;
  duration: number;
  kills: number;
  deaths: number;
  assists: number;
  heroLevel: number | null;
  items: MatchItemPurchase[];
}

export interface BuildItem {
  itemId: number;
  name: string;
  image: string | null;
  count: number;
  percentage: number;
}
export interface HeroBuild {
  heroId: number;
  sampleSize: number;
  lowConfidence: boolean;
  startingItems: BuildItem[];
  earlyItems: BuildItem[];
  coreItems: BuildItem[];
  situationalItems: BuildItem[];
}
