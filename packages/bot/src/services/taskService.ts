import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, TaskStatus, TaskPriority } from "@jadlis/shared";

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetches tasks due today that are actionable (pending or in_progress).
 */
export async function getTodayTasks(
  userId: string,
  supabase: SupabaseClient,
  date?: string,
): Promise<Task[]> {
  const today = date ?? getTodayDate();

  const { data, error } = await supabase
    .from("tasks")
    .select()
    .eq("user_id", userId)
    .eq("due_date", today)
    .in("status", ["pending", "in_progress"]);

  if (error) {
    throw new Error(`Failed to get today's tasks: ${error.message}`);
  }

  return (data ?? []) as Task[];
}

/**
 * Batch creates tasks for a specific date.
 */
export async function createTasksForDate(
  userId: string,
  tasks: Array<Pick<Task, "title" | "priority">>,
  date: string,
  supabase: SupabaseClient,
): Promise<Task[]> {
  const rows = tasks.map((t) => ({
    user_id: userId,
    title: t.title,
    priority: t.priority,
    status: "pending" as TaskStatus,
    due_date: date,
  }));

  const { data, error } = await supabase
    .from("tasks")
    .insert(rows)
    .select();

  if (error) {
    throw new Error(`Failed to create tasks: ${error.message}`);
  }

  return (data ?? []) as Task[];
}

/**
 * Updates a single task's status.
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to update task status: ${error.message}`);
  }
}

/**
 * Transfers a task to a new date while keeping status "pending".
 */
export async function transferTaskToDate(
  taskId: string,
  newDate: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ due_date: newDate, status: "pending" as TaskStatus })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to transfer task: ${error.message}`);
  }
}

/**
 * Defers a task by setting status = "deferred" and clearing due_date.
 */
export async function deferTask(
  taskId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "deferred" as TaskStatus, due_date: null })
    .eq("id", taskId);

  if (error) {
    throw new Error(`Failed to defer task: ${error.message}`);
  }
}
