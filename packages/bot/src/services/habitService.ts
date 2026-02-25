import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Finds or creates a habit by name for a user.
 * Returns the habit ID.
 *
 * Full implementation in section-08-data-integration.
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
 *
 * Full implementation in section-08-data-integration.
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

  // Trigger momentum update RPC
  const { error: rpcError } = await supabase.rpc("update_habit_momentum", {
    p_habit_id: habitId,
  });
  if (rpcError) {
    console.warn(`[habitService] Momentum RPC failed: ${rpcError.message}`);
  }
}
