/** Mismo orden que packages/shared/src/types.ts: el cliente nunca importa shared. */
export const SLOT_ORDER = ["GK", "LB", "CB1", "CB2", "RB", "CDM", "CM", "CAM", "LW", "ST", "RW"] as const;

export const SLOT_LABEL: Record<string, string> = {
  GK: "Portero", LB: "Lateral izquierdo", CB1: "Central", CB2: "Central",
  RB: "Lateral derecho", CDM: "Mediocentro defensivo", CM: "Mediocentro",
  CAM: "Mediapunta", LW: "Extremo izquierdo", ST: "Delantero", RW: "Extremo derecho",
};

export const SLOT_ABBR: Record<string, string> = {
  GK: "POR", LB: "LI", CB1: "DFC", CB2: "DFC", RB: "LD", CDM: "MCD",
  CM: "MC", CAM: "MP", LW: "EI", ST: "DC", RW: "ED",
};
