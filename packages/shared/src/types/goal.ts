export type GoalType = "physical" | "achievement" | "career";
/** Маппинг для обратной совместимости с DB (Ф/Д/К) */
export const GOAL_TYPE_MAP = {
  "Ф": "physical",
  "Д": "achievement",
  "К": "career",
} as const;
export type GoalStatus = "active" | "completed" | "paused" | "archived";
export type StageStatus = "pending" | "active" | "completed";

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string;
  type: GoalType;
  status: GoalStatus;
  target_date: Date | null;
  progress: number;
  need_ids: string[];
}

export interface Stage {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  order_index: number;
  status: StageStatus;
  target_date: Date | null;
}
