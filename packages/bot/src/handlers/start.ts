import type { SupabaseClient } from "@supabase/supabase-js";

export function createStartHandler(supabase: SupabaseClient) {
  return async function handleStart(ctx: any): Promise<void> {
    const telegramId = ctx.from?.id;
    if (telegramId == null) {
      await ctx.reply("Не удалось определить пользователя. Попробуй ещё раз.");
      return;
    }
    const username = ctx.from?.username ?? null;

    const { data: existing } = await supabase
      .from("users")
      .select("id, username")
      .eq("telegram_id", telegramId)
      .single();

    if (existing) {
      await ctx.reply(
        `С возвращением, ${existing.username ?? "друг"}! Я Jadlis — готов помочь.`,
      );
      return;
    }

    await supabase.from("users").insert({
      telegram_id: telegramId,
      username,
      settings: {},
    });

    await ctx.reply(
      "Привет! Я Jadlis — твой персональный AI-ассистент для улучшения жизни.\n\n" +
        "Напиши /help чтобы посмотреть доступные команды.",
    );
  };
}
