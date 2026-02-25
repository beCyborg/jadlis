import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Сервис для работы с записями дня (days).
 * Каждый день пользователя хранится как запись в таблице `days`.
 * @module dayService
 */

/**
 * Checks if the morning check-in is already completed today.
 * Returns true when a days record exists with zone IS NOT NULL.
 *
 * Full implementation in section-08-data-integration.
 */
export async function isMorningCompleted(
  userId: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("days")
    .select("zone")
    .eq("user_id", userId)
    .eq("date", today)
    .not("zone", "is", null)
    .maybeSingle();

  return data !== null;
}
