/**
 * НейроБаланс Zones — 7-level model representing user's current state.
 * Zones 1-2: crisis/exhaustion → minimal plan, recovery focus
 * Zones 3-4: decline/stable   → standard plan
 * Zones 5-7: rise/flow/superflow → ambitious plan, stretch goals
 */
export type NeuroBalanceZone =
  | "crisis"       // 1 — критический минимум
  | "exhaustion"   // 2 — истощение
  | "decline"      // 3 — спад
  | "stable"       // 4 — стабильность
  | "rise"         // 5 — подъём
  | "flow"         // 6 — поток
  | "superflow";   // 7 — сверхпоток

export const ZONE_LEVEL: Record<NeuroBalanceZone, number> = {
  crisis: 1,
  exhaustion: 2,
  decline: 3,
  stable: 4,
  rise: 5,
  flow: 6,
  superflow: 7,
};

/** Ordered zone list — index+1 = zone level (1-7). */
export const ZONE_ORDER: readonly NeuroBalanceZone[] = [
  "crisis",
  "exhaustion",
  "decline",
  "stable",
  "rise",
  "flow",
  "superflow",
] as const;

/** Convert 1-7 level to zone name. Clamps to valid range. */
export function levelToZone(level: number): NeuroBalanceZone {
  const clamped = Math.max(1, Math.min(7, Math.round(level)));
  return ZONE_ORDER[clamped - 1];
}

/** Convert zone name to 1-7 level. */
export function zoneToLevel(zone: NeuroBalanceZone): number {
  return ZONE_ORDER.indexOf(zone) + 1;
}

export interface DayRecord {
  id: string;
  user_id: string;
  date: string;
  overall_score: number | null;
  zone: NeuroBalanceZone | null;
  morning_plan: string | null;
  highlights: unknown[];
  ai_summary: string | null;
  created_at: string;
}

export interface WeekRecord {
  id: string;
  user_id: string;
  start_date: Date;
  end_date: Date;
  overall_score: number;
  highlights: Record<string, unknown>;
  ai_summary: string;
  created_at: Date;
}

export interface MonthRecord {
  id: string;
  user_id: string;
  start_date: Date;
  end_date: Date;
  overall_score: number;
  highlights: Record<string, unknown>;
  ai_summary: string;
  created_at: Date;
}

export interface QuarterRecord {
  id: string;
  user_id: string;
  start_date: Date;
  end_date: Date;
  overall_score: number;
  highlights: Record<string, unknown>;
  ai_summary: string;
  created_at: Date;
}
