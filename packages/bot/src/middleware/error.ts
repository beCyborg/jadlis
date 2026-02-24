import type { BotContext } from "../bot";

export async function errorBoundary(
  ctx: BotContext,
  next: () => Promise<void>,
): Promise<void> {
  try {
    await next();
  } catch (err) {
    console.error("Bot error:", err);
    try {
      await ctx.reply("Произошла ошибка. Попробуй ещё раз или напиши /help");
    } catch {
      // Reply itself failed — can't do anything
    }
  }
}
