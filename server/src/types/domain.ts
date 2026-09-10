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
/**
 * Counter/Synergy/RoleFit/Meta each 0-100; see server/src/services/scoring.ts
 * for how they combine into DraftRecommendation.score, and
 * server/src/services/draftAnalysisService.ts / roleFitService.ts for how
 * each is computed.
 */
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
  advancedInsights: AdvancedInsights;
}

/**
 * Advanced Insights: a strategic timeline answering "how should each team
 * play this draft across the game?" - see server/src/services/advancedInsights.ts
 * for the full model. Entirely derived from real hero data (OpenDota's role
 * tags, our own mapped positions) via a hand-written, documented heuristic;
 * never fabricated statistics, never AI-generated.
 */
export type GamePhase = "early" | "mid" | "late";
export type InsightConfidence = "high" | "medium" | "low";
export type PowerWindow = "Strong" | "Moderate" | "Weak";
export type PhaseAdvantage = "your" | "enemy" | "even";

export interface PhaseTeamStrategy {
  gamePlan: string;
  priorities: string[];
  avoid: string[];
  powerWindow: PowerWindow;
}

export interface PhaseComparison {
  phase: GamePhase;
  label: string;
  window: string;
  advantage: PhaseAdvantage;
  reason: string;
  yourTeam: PhaseTeamStrategy;
  enemyTeam: PhaseTeamStrategy;
  confidence: InsightConfidence;
}

export interface AdvancedInsights {
  early: PhaseComparison;
  mid: PhaseComparison;
  late: PhaseComparison;
  yourWinCondition: string;
  enemyWinCondition: string;
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

/**
 * Deterministic purchase-time grouping shared by a single match's item
 * timeline and the aggregated hero build (see heroBuildService.ts for the
 * exact thresholds) - not an OpenDota concept, our own documented rule.
 */
export type BuildCategory = "starting" | "early" | "core" | "situational";

export interface MatchItemPurchase {
  itemId: number;
  name: string;
  image: string | null;
  /** Seconds relative to game start; negative/zero for pre-game purchases. */
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
  /** Chronological, one entry per item (first purchase only if bought more than once). */
  items: MatchItemPurchase[];
}

export interface BuildItem {
  itemId: number;
  name: string;
  image: string | null;
  /** Number of analyzed matches where this item was purchased at least once. */
  count: number;
  /** count / sampleSize, i.e. the share of analyzed matches that bought this item. */
  percentage: number;
}

export interface HeroBuild {
  heroId: number;
  /** Exact number of recent matches analyzed that had usable item-purchase data. */
  sampleSize: number;
  lowConfidence: boolean;
  startingItems: BuildItem[];
  earlyItems: BuildItem[];
  coreItems: BuildItem[];
  situationalItems: BuildItem[];
}

/**
 * The best real-data hero for one application role, from
 * roleFitService.ts's position data (not the broad role *tags* used to
 * shortlist candidates - see getRoleRankings for how the two combine).
 */
export interface RoleRanking {
  role: Role;
  /** Null only if no candidate for this role has any usable position data at all. */
  hero: Hero | null;
  /** This hero's real win rate specifically in this position, if any games were sampled. */
  winRate: number | null;
  games: number;
}
