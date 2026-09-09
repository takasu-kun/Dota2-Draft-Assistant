import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { api } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();
app.use(cors({ origin: env.corsOrigin.split(",").map((x) => x.trim()), methods: ["GET", "POST"] }));
app.use(express.json({ limit: "32kb" }));
app.use("/api", api);

// Serves the built Vue app (root-level `npm run build` output) so a single
// process can host both the frontend and the API - see README for the
// deploy setup this supports. In local dev the frontend runs via its own
// Vite dev server instead, and this directory won't exist yet, so it's
// skipped rather than serving a stale or missing build.
const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../dist");
const clientIndexHtml = path.join(clientDist, "index.html");
if (existsSync(clientIndexHtml)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    // Client-side routes (vue-router history mode) all resolve to index.html.
    res.sendFile(clientIndexHtml, (err) => {
      if (err) next(err);
    });
  });
}

app.use(errorHandler);
