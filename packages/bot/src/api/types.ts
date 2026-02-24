import type { Context } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

/** Hono Env type for all Mini App API routes (set by hmacMiddleware). */
export type ApiEnv = {
  Variables: {
    telegramUser: TelegramUser;
  };
};

/**
 * Resolves the internal DB user from the Telegram user stored in context.
 * Returns the DB user { id } on success, or an error Response on failure.
 * The caller should check `instanceof Response` and return immediately.
 */
export async function resolveDbUser(
  c: Context<ApiEnv>,
  supabase: SupabaseClient,
): Promise<{ id: string } | Response> {
  const telegramUser = c.get("telegramUser");
  if (!telegramUser) {
    return c.json({ error: "No user context" }, 400);
  }

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("telegram_id", telegramUser.id)
    .single();

  if (!dbUser) {
    return c.json({ error: "User not found" }, 404);
  }

  return dbUser as { id: string };
}
