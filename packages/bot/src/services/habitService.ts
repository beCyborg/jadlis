import type { SupabaseClient } from "@supabase/supabase-js";
import type { Habit } from "@jadlis/shared";

/**
 * Finds or creates a habit by name for a user.
 * Returns the habit ID.
 */
export async function findOrCreateHabit(
  userId: string,
  name: string,
  supabase: SupabaseClient,
): Promise<string> {
  const { data: existing } = await supabase
    .from("habits")
    .select("id")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("habits")
    .insert({
      user_id: userId,
      name,
      frequency: "daily",
      status: "active",
      cue: "",
      routine: name,
      reward: "",
      need_ids: [],
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create habit "${name}": ${error?.message}`);
  }

  return created.id;
}

/**
 * Logs a habit completion and triggers momentum update.
 */
export async function logHabitCompletion(
  habitId: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase.from("habit_completions").insert({
    habit_id: habitId,
    user_id: userId,
    completed_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to log habit completion: ${error.message}`);
  }

  const { error: rpcError } = await supabase.rpc("update_habit_momentum", {
    p_habit_id: habitId,
    p_completed: true,
  });
  if (rpcError) {
    console.warn(`[habitService] Momentum RPC failed: ${rpcError.message}`);
  }
}

/**
 * Fetches habits for today's review — only daily active habits.
 */
export async function getTodayHabits(
  userId: string,
  supabase: SupabaseClient,
): Promise<Habit[]> {
  const { data, error } = await supabase
    .from("habits")
    .select()
    .eq("user_id", userId)
    .eq("frequency", "daily")
    .eq("status", "active");

  if (error) {
    throw new Error(`Failed to get today's habits: ${error.message}`);
  }

  return (data ?? []) as Habit[];
}

export interface StreakInfo {
  streaks: Record<string, number>;
  longestStreak: number;
}

/**
 * Returns current streak information for display in morning messages.
 */
export async function getStreakInfo(
  userId: string,
  supabase: SupabaseClient,
): Promise<StreakInfo> {
  const { data, error } = await supabase
    .from("habits")
    .select("id, streak")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw new Error(`Failed to get streak info: ${error.message}`);
  }

  const habits = (data ?? []) as Array<{ id: string; streak: number }>;
  const streaks: Record<string, number> = {};
  let longestStreak = 0;

  for (const h of habits) {
    streaks[h.id] = h.streak;
    if (h.streak > longestStreak) {
      longestStreak = h.streak;
    }
  }

  return { streaks, longestStreak };
}
