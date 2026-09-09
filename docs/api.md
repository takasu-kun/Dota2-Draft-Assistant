# Dota Draft API

Base URL: `http://localhost:3000/api`.

| Endpoint                               | Purpose                                    |
| -------------------------------------- | ------------------------------------------ |
| `GET /heroes?role=&attribute=&search=` | Filtered hero list.                        |
| `GET /heroes/:id`                      | Hero with stats, counters, and synergies.  |
| `GET /heroes/:id/counters`             | Counter relationships.                     |
| `GET /heroes/:id/synergies`            | Synergy relationships.                     |
| `GET /meta?role=`                      | Current patch and rankings.                |
| `POST /draft/analyze`                  | Validated Phase 1 draft-analysis contract. |

`POST /draft/analyze` body: `{ "yourTeam":[1], "enemyTeam":[2], "role":"support" }`.
Invalid requests return `400` with `{ "error": { "code":"VALIDATION_ERROR", "message":"..." } }`; unknown heroes return `404` / `HERO_NOT_FOUND`.
