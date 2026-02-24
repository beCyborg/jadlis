import type { BotContext } from "../bot";

export async function handleHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(
    "Доступные команды:\n\n" +
      "/start   — Начать работу\n" +
      "/help    — Список команд\n" +
      "/status  — Текущие метрики и сводка\n" +
      "/goals   — Цели и прогресс\n" +
      "/habits  — Привычки и серии\n\n" +
      "Или просто напиши мне сообщение — я пойму.",
  );
}
