export async function handleText(ctx: any): Promise<void> {
  // Placeholder: intent classification + AI routing
  // Will be implemented in section-06 (Claude API) and section-10 (Agent SDK)
  await ctx.reply(
    "Пока я умею только отвечать на команды. " +
      "AI-обработка текста будет доступна скоро.\n\n" +
      "Напиши /help для списка команд.",
  );
}
