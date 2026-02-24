import type { SupabaseClient } from "@supabase/supabase-js";

export function createAuthMiddleware(supabase: SupabaseClient) {
  return async function authMiddleware(
    ctx: any,
    next: () => Promise<void>,
  ): Promise<void> {
    // /start bypasses auth — allows new user creation
    if (ctx.message?.text?.startsWith("/start")) {
      await next();
      return;
    }

    const telegramId = ctx.from?.id;
    if (!telegramId) {
      await ctx.reply("Доступ запрещён.");
      return;
    }

    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .single();

    if (!data) {
      await ctx.reply("Доступ запрещён. Используй /start для регистрации.");
      return;
    }

    // Attach user UUID to context for downstream handlers
    ctx.userId = data.id;

    await next();
  };
}
