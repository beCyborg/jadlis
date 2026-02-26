export type TaskStatus = "pending" | "in_progress" | "done" | "deferred" | "cancelled";
export type TaskPriority = "high" | "medium" | "low";

export interface Task {
  id: string;
  user_id: string;
  stage_id: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  external_id: string | null;
}
