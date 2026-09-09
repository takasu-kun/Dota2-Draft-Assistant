import { request } from "./client";
import type { Hero, Role } from "./types";
export const getHeroes = (filters: { role?: Role; attribute?: string; search?: string } = {}) =>
  request<Hero[]>(
    `/heroes?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString()}`,
  );
export const getHero = (id: number) => request<Hero>(`/heroes/${id}`);
