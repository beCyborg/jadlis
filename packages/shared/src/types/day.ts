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

export interface DayRecord {
  id: string;
  user_id: string;
  date: string;
  overall_score: number | null;
  zone: NeuroBalanceZone | null;
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
