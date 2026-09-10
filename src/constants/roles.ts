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

// Deterministic, hand-written drafting advice per role - shown for any role
// slot still empty on "Your Team" so the player knows what to prioritize
// picking next. Intentionally not AI-generated / not data-driven.
export const ROLE_STRATEGY_TIPS: Record<Role, string> = {
  carry:
    "Prioritize a hero with strong late-game item scaling and a reliable farming pattern. Look at what's already drafted: if your team lacks damage output past the 25-minute mark, a hard carry closes that gap; if lanes are already damage-heavy, favor one who can also fight earlier.",
  mid: "Fill this with a hero who controls tempo - strong wave clear, kill potential, or the mobility to gank side lanes early. A mid who can convert a lead into map pressure covers for a slower-starting draft.",
  offlane:
    "Look for durability and initiation: a tanky hero who can start fights, soak up enemy cores' attention, or disrupt the enemy's key damage dealer. This slot should give the rest of the team space to operate.",
  support:
    "Fill this with a hero offering disables, healing, or buffs that protect your carry and mid through the laning stage. Prioritize whichever your draft is missing most - crowd control if fights are going even, sustain if lanes are losing.",
  "hard-support":
    "Take a vision and utility hero - wards, saves, and setup for teamfights - who can survive on a minimal item budget. This is also the slot to absorb a sacrifice (stacking, deep wards, scouting) so your cores can scale.",
};
