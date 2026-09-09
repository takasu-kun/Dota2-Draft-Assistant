import type { DraftAnalysis, Hero, Role } from "../types/domain.js";
import { getCounters, getHero, getSynergies, listHeroes } from "./heroService.js";

export interface DraftAnalysisInput {
  yourTeam: number[];
  enemyTeam: number[];
  role: Role;
}

const ALL_ROLES: Role[] = ["carry", "mid", "offlane", "support", "hard-support"];
const RECOMMENDATION_LIMIT = 5;

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

/** Adds `points` to `scores.get(id)`, creating the entry if needed. */
function addScore(scores: Map<number, number>, id: number, points: number): void {
  scores.set(id, (scores.get(id) ?? 0) + points);
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

  // Score every candidate for the requested role by how well it counters the
  // enemy draft and how well it synergizes with our existing picks, keeping
  // a human-readable reason for each contribution so the client can explain
  // *why* a hero was recommended instead of just showing a bare number.
  const scores = new Map<number, number>();
  const reasons = new Map<number, string[]>();
  const addReason = (id: number, reason: string) =>
    reasons.set(id, [...(reasons.get(id) ?? []), reason]);

  enemyCounters.forEach((counters, i) => {
    for (const c of counters) {
      addScore(scores, c.hero.id, c.score * 0.6);
      addReason(c.hero.id, `Counters ${enemyHeroes[i].name}`);
    }
  });
  yourSynergies.forEach((synergies, i) => {
    for (const s of synergies) {
      addScore(scores, s.hero.id, s.score * 0.4);
      addReason(s.hero.id, `Synergizes with ${yourHeroes[i].name}`);
    }
  });

  const picked = new Set([...input.yourTeam, ...input.enemyTeam]);
  const candidates = (await listHeroes({ role: input.role })).filter((h) => !picked.has(h.id));
  const recommendations: DraftAnalysis["recommendations"] = candidates
    .map((hero) => ({
      hero,
      rawScore: (scores.get(hero.id) ?? 0) + (hero.winRate ?? 0) * 0.1,
      reasons: reasons.get(hero.id) ?? [],
    }))
    .sort((a, b) => b.rawScore - a.rawScore)
    .slice(0, RECOMMENDATION_LIMIT)
    .map((r) => ({
      hero: r.hero,
      score: Math.round(Math.min(100, r.rawScore)),
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
