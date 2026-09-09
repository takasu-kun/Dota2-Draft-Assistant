# Dota 2 Draft Assistant

A Vue frontend backed by a Node/Express API. The API has no database of its own - hero data, matchups, and synergies are fetched live from the [OpenDota API](https://docs.opendota.com/) (with in-memory caching; see `server/src/services/`).

## Local development

Copy `.env.example` in `server/` (the root `.env.example` isn't needed for the default setup - see the comment in it). Run `npm install` in the root and in `server/`. Run `npm run dev` at root (Vue app on `:5173`, proxying `/api` to the backend) and `npm run dev` from `server/` (API on `:3000`).

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
