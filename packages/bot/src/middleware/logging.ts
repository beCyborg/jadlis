import type { BotContext } from "../bot";

export async function requestLogger(
  ctx: BotContext,
  next: () => Promise<void>,
): Promise<void> {
  const chatId = ctx.chat?.id;
  const username = ctx.from?.username ?? "unknown";
  const updateType = Object.keys(ctx.update).find((k) => k !== "update_id") ?? "unknown";
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
