import { app } from "./app.js";
import { env } from "./config/env.js";
app.listen(env.port, () => console.log(`Dota Draft API listening on :${env.port}`));
