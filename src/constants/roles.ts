import type { Role } from "../api/types";

export const ROLE_LABELS: Record<Role, string> = {
  carry: "Carry",
  mid: "Mid",
  offlane: "Offlane",
  support: "Support",
  "hard-support": "Hard Support",
};

export const ROLE_POSITIONS: Record<Role, string> = {
  carry: "Pos 1",
  mid: "Pos 2",
  offlane: "Pos 3",
  support: "Pos 4",
  "hard-support": "Pos 5",
};
