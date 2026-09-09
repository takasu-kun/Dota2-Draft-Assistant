import { request } from "./client";
import type { Meta, Role } from "./types";
export const getMeta = (role?: Role) => request<Meta>(`/meta${role ? `?role=${role}` : ""}`);
