export async function dedupGuard(
  ctx: any,
  next: () => Promise<void>,
): Promise<void> {
  if (ctx.session?.processing) {
    await ctx.reply("Обрабатываю предыдущий запрос... Подожди немного");
    return;
  }
  ctx.session.processing = true;
  try {
    await next();
  } finally {
    ctx.session.processing = false;
  }
}
