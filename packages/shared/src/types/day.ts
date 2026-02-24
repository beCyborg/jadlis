export type NeuroBalanceZone = "green" | "yellow" | "red";

export interface DayRecord {
  id: string;
  user_id: string;
  date: Date;
  overall_score: number;
  zone: NeuroBalanceZone;
  highlights: Record<string, unknown>;
  ai_summary: string;
  created_at: Date;
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
