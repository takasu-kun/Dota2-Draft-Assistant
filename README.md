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

Two data-driven features on top of the same OpenDota integration, both read-only and stateless like everything else in this app.

**Hero Matches** (`/matches`) shows a hero's recent matches. Backed by `GET /api/heroes/:id/matches` (frontend: `src/api/matches.ts`), which wraps OpenDota's `GET /heroes/{id}/matches`. That endpoint only covers **professional/league matches** (OpenDota's public API has no "recent pub matches for a hero" endpoint) and returns a fixed, unpaginated list, newest first. The backend (`server/src/services/heroMatchService.ts`) fetches and caches that list once per hero, computes each match's result **from the selected hero's perspective** (comparing `player_slot` against `radiant_win`, not just the overall match winner), and paginates the cached list itself for "Load More" - no repeated upstream calls per page.

**Hero Builds** (`/builds`) shows a hero's common item builds. OpenDota has no "recommended build" endpoint, so this is aggregated from `GET /heroes/{id}/itemPopularity` (raw purchase counts by game phase, from pro matches) via `GET /api/heroes/:id/builds` (frontend: `src/api/builds.ts`, backend: `server/src/services/heroBuildService.ts`). OpenDota's four phases (`start_game_items`/`early_game_items`/`mid_game_items`/`late_game_items`) map to **Starting / Early Game / Core / Situational**; each item's percentage is relative to the top item in its own category, and the page's "based on ~N matches" figure is a best-effort proxy (the top starting item's count, since that's bought in nearly every game) rather than an exact match count OpenDota doesn't expose. **Skill build and talent-pick data don't exist anywhere in OpenDota's public API** - rather than fabricate them, `HeroBuild` simply has no fields for them, and the page says so explicitly instead of showing an empty section.

Both endpoints validate the hero id and return `404 HERO_NOT_FOUND` for an unknown one, and map any OpenDota failure to a client-safe `502` (`HERO_MATCHES_FAILED` / `HERO_BUILDS_FAILED`) rather than leaking upstream error details - see `server/src/controllers/heroesController.ts`.

Hero Explorer cards link into both (`View Matches` / `View Builds`, preserving the hero id via `?hero=`), and both pages share `src/components/heroes/HeroSelector.vue` for picking a hero.

## Deploying (single Render web service)

In production, the Express server also serves the built Vue app as static files (see `server/src/app.ts`), so the whole thing deploys as **one service on one host** - no separate static host, no CORS to configure.

1. **Push this repo to GitHub.** This project isn't a git repo yet:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
   Then create a repo on GitHub and push to it (`git remote add origin <url>`, `git push -u origin main`).
2. **Create a Render Blueprint.** In the Render dashboard: New → Blueprint → connect the GitHub repo. Render reads [`render.yaml`](render.yaml) at the repo root and configures the service automatically (build command, start command, `PORT`) - no manual dashboard setup needed.
3. **Deploy.** Render builds the frontend (`npm run build` at root → `dist/`) and the API (`npm run build` in `server/` → `server/dist/`), then runs `node server/dist/index.js`, which serves both.

Every push to the connected branch redeploys automatically. To deploy without a Blueprint, configure a Render Web Service manually with:

- Build command: `npm install && npm run build && cd server && npm install && npm run build`
- Start command: `node server/dist/index.js`
- Root directory: repo root (not `server/`)
