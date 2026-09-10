# Dota 2 Draft Assistant

A Vue frontend backed by a Node/Express API. The API has no database of its own - hero data, matchups, and synergies are fetched live from the [OpenDota API](https://docs.opendota.com/) (with in-memory caching; see `server/src/services/`).

```text
Vue 3 Frontend → Node.js/Express Backend → OpenDota API
```

Areas: **Draft Assistant** (`/`), **Hero Explorer** (`/heroes`), **Hero Matches** (`/matches`), **Hero Builds** (`/builds`), **Meta Insights** (`/meta`). No database, no accounts, no saved/persisted state anywhere on the server.

## Local development

Copy `.env.example` in `server/` (the root `.env.example` isn't needed for the default setup - see the comment in it). Run `npm install` in the root and in `server/`. Run `npm run dev` at root (Vue app on `:5173`, proxying `/api` to the backend) and `npm run dev` from `server/` (API on `:3000`).

Run backend tests with `npm test` in `server/` (Node's built-in test runner; unit tests for the win/loss and item-build aggregation logic, plus a few HTTP-level validation checks).

## Phase 1.5: Hero Matches & Hero Builds

Three data-driven features on top of the same OpenDota integration, all read-only and stateless like everything else in this app:

```text
Hero
 ↓
Recent Matches            GET /heroes/{id}/matches       (server/src/services/heroMatchService.ts)
 ↓
Match Details              GET /matches/{match_id}         (per selected match, and per analyzed match)
 ↓
Player Item Purchases      player.purchase_log             (server/src/services/itemBuild.ts)
 ↓
Aggregation                 tally across analyzed matches   (server/src/services/heroBuildService.ts)
 ↓
Common Build
```

**Hero Matches** (`/matches`) shows a hero's recent matches via `GET /api/heroes/:id/matches` (frontend: `src/api/matches.ts`). This only covers **professional/league matches** - OpenDota's public API has no "recent pub matches for a hero" endpoint. The result list is fetched and cached once per hero, then paginated ourselves for "Load More" (no repeated upstream calls per page), with each match's result computed **from the selected hero's perspective** (`player_slot` vs `radiant_win`, not just the overall winner).

**Match Item Builds**: selecting a match on that page calls `GET /api/heroes/:heroId/matches/:matchId`, which fetches that match's full detail, finds the player who played the selected hero (matched by `hero_id`, not just slot position), and returns their result/K-D-A/final level plus their `purchase_log` - the actual items they bought and when, turned into a chronological timeline. Purchases are deduplicated to first-purchase-per-item (so rebuying tangoes/wards doesn't clutter the timeline) and recipe scrolls are dropped (a checkout artifact, not a build choice); everything else is exactly what that player bought in that match, nothing invented.

**Hero Builds** (`/builds`, `GET /api/heroes/:id/builds`) aggregates that same per-match item data across multiple recent matches - not OpenDota's own pre-aggregated `itemPopularity` endpoint, which was Phase 1.5's first pass at this feature and reused OpenDota's own build-in aggregation instead of ours. Analyzing _every_ pro match for a popular hero (up to ~100) would mean ~100 upstream `/matches/{id}` calls per build lookup, too slow and too close to OpenDota's free-tier rate limit, so this bounds the sample to the 20 most recent matches (fetched 5-at-a-time) and reports the real, possibly-smaller number of matches that actually had usable purchase data - never a fabricated "based on 100 matches." Each item's percentage is exactly `matches that bought it ÷ matches analyzed`. Purchases are grouped into **Starting / Early Game / Core / Situational** by a documented, deterministic purchase-time rule (`categorizeByTime` in `itemBuild.ts`) - not by any OpenDota-assigned category - shared between this aggregation and a single match's item timeline, so both agree. A "View Matches" link lets you inspect the underlying matches yourself. **Skill build and talent-pick data don't exist anywhere in OpenDota's public API** - rather than fabricate them, `HeroBuild` simply has no fields for them, and the page says so explicitly instead of showing an empty section.

These are **data-derived builds, aggregated from real match purchase logs - not official Valve or OpenDota recommendations.**

All three endpoints validate their id(s) and return `404` (`HERO_NOT_FOUND` / `MATCH_NOT_FOUND` / `HERO_NOT_IN_MATCH`) for an unknown hero/match/combination, and map any OpenDota failure to a client-safe `502` rather than leaking upstream error details - see `server/src/controllers/heroesController.ts`.

Hero Explorer cards link into both pages (`View Matches` / `View Builds`, preserving the hero id via `?hero=`), and both pages share `src/components/heroes/HeroSelector.vue` for picking a hero.

## Phase 2: Draft Recommendation Engine

`POST /api/draft/analyze` (`server/src/services/draftAnalysisService.ts`) scores every eligible candidate hero for the requested role and returns the top 5, ranked, with a full explanation. A candidate is any hero matching the requested role that isn't already on either team - duplicates and already-picked heroes are never recommended.

Each candidate gets four independent 0-100 scores, combined with centralized, documented weights (`server/src/services/scoring.ts`):

```text
Counter Score      40%   - how well the candidate matches up against the enemy lineup (real OpenDota matchup data)
Synergy Score      30%   - how well the candidate pairs with the current team (real teammate win-rate data)
Role Fit Score     15%   - how well the candidate suits the requested position (see below)
Meta Score         15%   - how strong/popular the candidate is right now (win rate + pick rate)

Final Score = Counter×0.40 + Synergy×0.30 + RoleFit×0.15 + Meta×0.15
```

**Counter/Synergy** reuse the same per-hero matchup/synergy lookups Hero Explorer already uses; a candidate's score is the average of its matched relationship scores against the enemy/ally heroes actually in the draft. No matching evidence found (only each hero's top-10 relationships are checked) yields a neutral 50, not a 0 - absence isn't evidence of a bad matchup.

**Role Fit** (`server/src/services/roleFitService.ts`) is intentionally _not_ the same signal as Meta - it answers "does this hero suit this position?", not "is this hero strong overall?". OpenDota's public API has no "win rate by position 1-5" endpoint (that 5-way split is a community convention, not a data column), so this is built from what's actually real and queryable: each match's `lane_role` (safe/mid/off) and `is_roaming` flag, via a documented SQL aggregation. That reliably identifies carry/mid/offlane; it cannot distinguish position 4 from position 5 (both are "roaming" games in OpenDota's schema), so support and hard support deliberately read the same evidence rather than a fabricated split. The score blends _prevalence_ (how often the hero is actually played that way) with a sample-size-aware win rate (a small sample is shrunk toward neutral so it can't outrank a much larger, reliable one - see the worked example in `roleFitService.ts`). A hero with zero position data falls back to OpenDota's real hero role tags (e.g. "Support", "Carry") via a small, clearly-labeled heuristic table; a hero with neither falls back to a neutral 50. This is the only per-candidate signal that costs a fresh OpenDota call (one per not-yet-cached candidate, bounded concurrency) - Counter/Synergy reuse existing lookups and Meta reuses fields already on the Hero object.

**Meta Score** is the hero's overall win rate and pick rate (already computed in `heroService.ts`), amplified around a 50% baseline the same way Role Fit's win rate is, so it uses more of the 0-100 range.

Meta Insights' "Role Rankings" panel (`GET /api/meta/role-rankings`) reuses this same real position data, not the broad role tags: a hero's tags can span several positions at once (Wraith King's tags map to 4 of 5), and picking "highest _overall_ win rate among heroes with this tag" meant one high-win-rate hero could top every role it was loosely tagged into, whether or not it was ever actually played that way. This endpoint instead uses the tag-based list only to shortlist the most-picked plausible candidates per role (fetching real position data for every tagged hero across all 5 roles would be too many upstream calls for one page load), then real data decides the winner and its real win rate for that specific position. It's deliberately a separate, slower endpoint from `GET /api/meta` (which stays fast - it backs the patch display on every page) and loads independently on the Meta Insights page.

Recommendation reasons are generated from the actual score components, not hardcoded per hero: a named reason like "Counters Weaver" or "Synergizes with Anti-Mage" for every matched relationship, plus "Strong fit for the support role" / "Good current meta performance" when those scores clear a threshold. No AI, no LLM - every reason traces back to a real number in the breakdown.

Draft Score, Strengths, Weaknesses, and Priorities are unchanged from the original engine (win-rate edge between the two teams plus real counter/synergy hits, missing-role coverage) - Phase 2 only replaced how _recommendations_ are scored and explained.

One practical note: OpenDota's free tier rate-limits to ~60 requests/minute. Role Fit's per-candidate lookups are cached for 10 minutes per hero, so the first analysis for a given role after a cache expiry is the slow one (several seconds); heavy concurrent use can occasionally hit that limit, in which case the affected request gets a client-safe `502` rather than a stack trace.

## Advanced Insights: Early/Mid/Late strategic timeline

`analyzeDraft`'s response also carries `advancedInsights` (`server/src/services/advancedInsights.ts`), shown in the Draft Assistant's "Advanced Insights" panel below the existing Draft Analysis (Draft Score/Strengths/Weaknesses) and Recommended Picks - it doesn't replace or recompute either of those. It answers a different question: **"given the heroes drafted so far, how should each team play the Early Game (0-15 min), Mid Game (15-30 min), and Late Game (30+ min)?"**

This is a deterministic heuristic model, not a prediction:

1. Every hero's real OpenDota role tags (`GET /heroStats`'s `roles` field - e.g. `Carry`, `Disabler`, `Initiator`, `Durable`, `Support`, `Nuker`, `Pusher`, `Jungler`, `Escape`) already fetched for the rest of the recommendation engine are reused here - no extra OpenDota requests.
2. A hand-written, centralized weight table maps those tags onto eight strategic **dimensions**: laning, teamfight, pickoff, push, scaling, farming, catch, sustain. A team's score per dimension is the _average_ contribution per rostered hero (not a sum), so a 1-2 hero partial draft is scored fairly rather than being penalized just for having fewer heroes than a full 5-stack.
3. A second centralized weight table (each phase's weights documented to sum to 1, same convention as `scoring.ts`'s `SCORING_WEIGHTS`) blends those eight dimensions into three phase scores - e.g. Late Game weighs scaling/teamfight/sustain; Early Game weighs laning/pickoff/catch/farming.
4. Comparing your team's and the enemy's phase score (past a centralized threshold) produces a Your Team / Enemy / Even **advantage** call for that phase, with a reason naming the deciding dimension. Each phase also gets a qualitative **Power Window** (Strong/Moderate/Weak, thresholded the same way) instead of a fabricated percentage.
5. Game plan, priorities, and warnings are template sentences chosen from _which dimensions actually scored high or low for this specific draft_ - never a hardcoded per-hero script - and are written from each side's own point of view (the enemy card is phrased "their"/"the enemy's", never "your").
6. A **confidence** level (high/medium/low, kept internal - not a scary label shown to the user) reflects how much real tag data actually backed a phase's numbers, surfaced only as a soft "limited data" note when it's low. Missing data, a single-hero team, or heroes with no matching tags never crash the engine - they degrade to neutral scores instead.

Nothing here invents a statistic OpenDota doesn't provide (no fabricated timings, GPM, or phase-specific win rates) - every number traces back to a hero's real role tags through a documented, adjustable heuristic, and every threshold/weight lives in one place in `advancedInsights.ts` rather than scattered through the code. It's still just strategic _analysis_: the copy is deliberately hedged ("Your draft has a strong early-game advantage", never "you will win early").

## Deploying (single Render web service)

In production, the Express server also serves the built Vue app as static files (see `server/src/app.ts`), so the whole thing deploys as **one service on one host** - no separate static host, no CORS to configure.

1. **Push this repo to GitHub** (`git push`).
2. **Create a Render Blueprint.** In the Render dashboard: New → Blueprint → connect the GitHub repo. Render reads [`render.yaml`](render.yaml) at the repo root and configures the service automatically (build command, start command, `PORT`) - no manual dashboard setup needed.
3. **Deploy.** Render builds the frontend (`npm run build` at root → `dist/`) and the API (`npm run build` in `server/` → `server/dist/`), then runs `node server/dist/index.js`, which serves both.

Every push to the connected branch redeploys automatically. To deploy without a Blueprint, configure a Render Web Service manually with:

- Build command: `npm install && npm run build && cd server && npm install && npm run build`
- Start command: `node server/dist/index.js`
- Root directory: repo root (not `server/`)
