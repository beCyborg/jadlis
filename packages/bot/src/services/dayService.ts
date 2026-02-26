import type { SupabaseClient } from "@supabase/supabase-js";
import type { DayRecord } from "@jadlis/shared";

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns today's day record for the user, creating one if it doesn't exist.
 * Uses upsert with date = today (UTC date).
 */
export async function getOrCreateTodayRecord(
  userId: string,
  supabase: SupabaseClient,
  date?: string,
): Promise<DayRecord> {
  const today = date ?? getTodayDate();

  const { data, error } = await supabase
    .from("days")
    .upsert(
      { user_id: userId, date: today },
      { onConflict: "user_id,date" },
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to get/create day record: ${error.message}`);
  }

  return data as DayRecord;
}

/**
 * Updates a single field of today's day record.
 */
export async function updateDayField(
  userId: string,
  field: keyof DayRecord,
  value: unknown,
  supabase: SupabaseClient,
  date?: string,
): Promise<void> {
  const today = date ?? getTodayDate();

  const { error } = await supabase
    .from("days")
    .update({ [field]: value })
    .eq("user_id", userId)
    .eq("date", today);

  if (error) {
    throw new Error(`Failed to update day field "${field}": ${error.message}`);
  }
}

/**
 * Appends a highlight text to the days.highlights JSONB array.
 * Uses Postgres-level array append to avoid race conditions.
 */
export async function appendHighlight(
  userId: string,
  text: string,
  supabase: SupabaseClient,
  date?: string,
): Promise<void> {
  const today = date ?? getTodayDate();

  const { error } = await supabase.rpc("append_day_highlight", {
    p_user_id: userId,
    p_date: today,
    p_highlight: text,
  });

  if (error) {
    throw new Error(`Failed to append highlight: ${error.message}`);
  }
}

/**
 * Returns true if today's day record has zone IS NOT NULL.
 * Used as duplicate ritual protection before entering morning check-in.
 */
export async function isMorningCompleted(
  userId: string,
  supabase: SupabaseClient,
  date?: string,
): Promise<boolean> {
  const today = date ?? getTodayDate();

  const { data, error } = await supabase
    .from("days")
    .select("zone")
    .eq("user_id", userId)
    .eq("date", today)
    .not("zone", "is", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check morning completion: ${error.message}`);
  }

  return data !== null;
}

/**
 * Returns true if today's day record has overall_score IS NOT NULL.
 * Used as duplicate ritual protection before entering evening scanner.
 */
export async function isEveningCompleted(
  userId: string,
  supabase: SupabaseClient,
  date?: string,
): Promise<boolean> {
  const today = date ?? getTodayDate();

  const { data, error } = await supabase
    .from("days")
    .select("overall_score")
    .eq("user_id", userId)
    .eq("date", today)
    .not("overall_score", "is", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check evening completion: ${error.message}`);
  }

  return data !== null;
}
