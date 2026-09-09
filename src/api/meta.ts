import { request } from "./client";
import type { Meta, Role, RoleRanking } from "./types";
export const getMeta = (role?: Role) => request<Meta>(`/meta${role ? `?role=${role}` : ""}`);
export const getRoleRankings = () => request<RoleRanking[]>("/meta/role-rankings");
