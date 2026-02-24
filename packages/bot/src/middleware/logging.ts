export async function requestLogger(
  ctx: any,
  next: () => Promise<void>,
): Promise<void> {
  const chatId = ctx.chat?.id;
  const updateType = ctx.updateType;
  const username = ctx.from?.username ?? "unknown";
  console.log(
    JSON.stringify({
      chat_id: chatId,
      update_type: updateType,
      timestamp: new Date().toISOString(),
      username,
    }),
  );
  await next();
}
