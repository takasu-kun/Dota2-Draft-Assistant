import type {
  DraftAnalysis,
  DraftRecommendation,
  Hero,
  Role,
  ScoreBreakdown,
} from "../types/domain.js";
import { getCounters, getHero, getRawRoleTags, getSynergies, listHeroes } from "./heroService.js";
import { getRoleFit } from "./roleFitService.js";
import { computeFinalScore, computeMetaScore } from "./scoring.js";
import { mapWithConcurrency } from "./concurrency.js";

export interface DraftAnalysisInput {
  yourTeam: number[];
  enemyTeam: number[];
  role: Role;
}

const ALL_ROLES: Role[] = ["carry", "mid", "offlane", "support", "hard-support"];
const RECOMMENDATION_LIMIT = 5;
// A candidate with no matching counter/synergy evidence isn't necessarily a
// bad pick - we only checked each enemy/ally's top-10 relationship list, so
// absence just means "no signal found", which reads as neutral, not 0.
const NEUTRAL_SCORE = 50;
const ROLE_FIT_STRONG_THRESHOLD = 70;
const META_STRONG_THRESHOLD = 65;
// Role Fit needs one /explorer call per not-yet-cached candidate hero (see
// roleFitService.ts) - bounded concurrency keeps a cold-cache request from
// bursting past OpenDota's rate limit while still finishing in a reasonable
// time (candidates are typically 20-40 heroes for a given role).
const CANDIDATE_ROLE_FIT_CONCURRENCY = 6;

function notFound(): never {
  throw Object.assign(new Error("One or more heroes were not found."), {
    code: "HERO_NOT_FOUND",
    status: 404,
  });
}

async function requireHeroes(ids: number[]): Promise<Hero[]> {
  const heroes = await Promise.all(ids.map(getHero));
  return heroes.map((hero) => hero ?? notFound());
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function roleLabel(role: Role): string {
  return role.replace("-", " ");
}

export async function analyzeDraft(input: DraftAnalysisInput): Promise<DraftAnalysis> {
  const [yourHeroes, enemyHeroes] = await Promise.all([
    requireHeroes(input.yourTeam),
    requireHeroes(input.enemyTeam),
  ]);

  // Bounded by team size (<=5 each), run in parallel: REST matchup lookups
  // are fast, the synergy lookups hit OpenDota's /explorer endpoint and are
  // the slowest part of this request.
  const [yourCounters, enemyCounters, yourSynergies] = await Promise.all([
    Promise.all(input.yourTeam.map(getCounters)), // who counters each of our picks
    Promise.all(input.enemyTeam.map(getCounters)), // who counters each enemy pick (i.e. good picks for us)
    Promise.all(input.yourTeam.map(getSynergies)), // who pairs well with each of our picks
  ]);

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const uncoveredEnemies: string[] = [];

  input.yourTeam.forEach((yourId, i) => {
    const yourName = yourHeroes[i].name;
    const hardCounter = yourCounters[i].find((c) => input.enemyTeam.includes(c.hero.id));
    if (hardCounter) {
      weaknesses.push(`${hardCounter.hero.name} counters ${yourName}`);
      uncoveredEnemies.push(hardCounter.hero.name);
    }

    const paired = yourSynergies[i].find(
      (s) => input.yourTeam.includes(s.hero.id) && s.hero.id !== yourId,
    );
    if (paired)
      strengths.push(
        `${yourName} and ${paired.hero.name} have strong synergy (~${paired.score}% win rate together)`,
      );
  });

  input.enemyTeam.forEach((enemyId, i) => {
    const goodPick = enemyCounters[i].find((c) => input.yourTeam.includes(c.hero.id));
    if (goodPick) strengths.push(`${goodPick.hero.name} counters ${enemyHeroes[i].name}`);
  });

  // Counter Score / Synergy Score per candidate: real matchup/synergy
  // evidence gathered above, keyed by candidate hero id, with a
  // human-readable reason kept alongside each match for the "why this
  // hero?" explanation.
  const counterEvidence = new Map<number, { scores: number[]; reasons: string[] }>();
  const synergyEvidence = new Map<number, { scores: number[]; reasons: string[] }>();
  function addEvidence(
    map: Map<number, { scores: number[]; reasons: string[] }>,
    id: number,
    score: number,
    reason: string,
  ) {
    const entry = map.get(id) ?? { scores: [], reasons: [] };
    entry.scores.push(score);
    entry.reasons.push(reason);
    map.set(id, entry);
  }
  enemyCounters.forEach((counters, i) => {
    for (const c of counters)
      addEvidence(counterEvidence, c.hero.id, c.score, `Counters ${enemyHeroes[i].name}`);
  });
  yourSynergies.forEach((synergies, i) => {
    for (const s of synergies)
      addEvidence(synergyEvidence, s.hero.id, s.score, `Synergizes with ${yourHeroes[i].name}`);
  });

  const picked = new Set([...input.yourTeam, ...input.enemyTeam]);
  const candidates = (await listHeroes({ role: input.role })).filter((h) => !picked.has(h.id));

  // Role Fit is the only per-candidate signal that needs a fresh OpenDota
  // call (Counter/Synergy reuse the enemy/ally lookups above; Meta reuses
  // fields already on the Hero object) - see roleFitService.ts for the real
  // position-data-first, tag-fallback, neutral-last priority order.
  const roleFits = await mapWithConcurrency(
    candidates,
    CANDIDATE_ROLE_FIT_CONCURRENCY,
    async (hero) => {
      const rawTags = await getRawRoleTags(hero.id);
      return getRoleFit(hero.id, input.role, rawTags);
    },
  );

  const recommendations: DraftRecommendation[] = candidates
    .map((hero, i) => {
      const counter = counterEvidence.get(hero.id);
      const synergy = synergyEvidence.get(hero.id);
      const breakdown: ScoreBreakdown = {
        counter: counter ? Math.round(average(counter.scores)) : NEUTRAL_SCORE,
        synergy: synergy ? Math.round(average(synergy.scores)) : NEUTRAL_SCORE,
        roleFit: roleFits[i].score,
        meta: computeMetaScore(hero),
      };
      const reasons = [...(counter?.reasons ?? []), ...(synergy?.reasons ?? [])];
      if (breakdown.roleFit >= ROLE_FIT_STRONG_THRESHOLD)
        reasons.push(`Strong fit for the ${roleLabel(input.role)} role`);
      if (breakdown.meta >= META_STRONG_THRESHOLD) reasons.push("Good current meta performance");
      return { hero, breakdown, finalScore: computeFinalScore(breakdown), reasons };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, RECOMMENDATION_LIMIT)
    .map((r) => ({
      hero: r.hero,
      score: r.finalScore,
      breakdown: r.breakdown,
      reasons: r.reasons,
    }));

  const missingRoles = ALL_ROLES.filter((role) => !yourHeroes.some((h) => h.roles.includes(role)));
  const priorities: DraftAnalysis["priorities"] = [
    ...[...new Set(uncoveredEnemies)].map((name) => ({
      priority: "high" as const,
      name: `Answer for ${name}`,
    })),
    ...missingRoles.map((role) => ({
      priority: "medium" as const,
      name: `Missing ${role} coverage`,
    })),
  ].slice(0, 5);

  const avgWinRate = (heroes: Hero[]) =>
    heroes.reduce((sum, h) => sum + (h.winRate ?? 50), 0) / (heroes.length || 1);
  const winRateEdge = avgWinRate(yourHeroes) - avgWinRate(enemyHeroes);
  const draftScore = Math.round(
    Math.min(
      100,
      Math.max(0, 50 + winRateEdge * 1.5 + strengths.length * 4 - weaknesses.length * 4),
    ),
  );

  return {
    draftScore,
    strengths: strengths.length ? strengths : ["No standout matchups identified yet"],
    weaknesses: weaknesses.length ? weaknesses : ["No major counters identified yet"],
    priorities,
    recommendations,
  };
}
