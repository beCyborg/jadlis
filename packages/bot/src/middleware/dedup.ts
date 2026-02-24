export async function dedupGuard(
  ctx: any,
  next: () => Promise<void>,
): Promise<void> {
  if (ctx.session?.processing) {
    await ctx.reply("Обрабатываю предыдущий запрос... Подожди немного");
    return;
  }
  await next();
}
