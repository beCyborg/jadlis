export type HabitFrequency = "daily" | "weekly" | "custom";

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  cue: string;
  routine: string;
  reward: string;
  frequency: HabitFrequency;
  momentum: number;
  streak: number;
  grace_days: number;
  need_ids: string[];
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  completed_at: Date;
  notes: string | null;
}
