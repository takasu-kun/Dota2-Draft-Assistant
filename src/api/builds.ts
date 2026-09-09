import { request } from "./client";
import type { HeroBuild } from "./types";
export const getHeroBuild = (heroId: number) => request<HeroBuild>(`/heroes/${heroId}/builds`);
