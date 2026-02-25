import type { Bot } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import type { Conversation } from "@grammyjs/conversations";
import type { BotContext } from "../bot";
import { createRedisStorage } from "./storage";

/** Conversation version — increment when conversation logic changes. */
const CONVERSATION_VERSION = 1;

/** Timeout for all conversations: 1 hour. */
const CONVERSATION_TIMEOUT_MS = 3_600_000;

// Placeholder conversation builders (replaced by sections 04 and 05)
async function morningCheckin(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
) {
  // Stub — will be implemented in section-04-morning-checkin
  await ctx.reply("Утренний чек-ин пока в разработке.");
}

async function eveningScanner(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
) {
  // Stub — will be implemented in section-05-evening-scanner
  await ctx.reply("Вечерний сканер пока в разработке.");
}

/**
 * Sets up the grammY Conversations plugin on the bot instance.
 * Must be called AFTER session middleware, BEFORE dedupGuard.
 * Uses shared Redis connection from queue/connection.ts.
 */
export function setupConversations(bot: Bot<BotContext>): void {
  bot.use(
    conversations<BotContext, BotContext>({
      storage: {
        type: "key",
        version: CONVERSATION_VERSION,
        adapter: createRedisStorage(),
      },
    }),
  );

  bot.use(
    createConversation<BotContext, BotContext>(morningCheckin, {
      id: "morningCheckin",
      maxMillisecondsToWait: CONVERSATION_TIMEOUT_MS,
    }),
  );

  bot.use(
    createConversation<BotContext, BotContext>(eveningScanner, {
      id: "eveningScanner",
      maxMillisecondsToWait: CONVERSATION_TIMEOUT_MS,
    }),
  );

  // /cancel command — exits any active conversation
  bot.command("cancel", async (ctx) => {
    const active = ctx.conversation.active();
    if (Object.keys(active).length === 0) {
      await ctx.reply("Нет активных ритуалов для отмены.");
      return;
    }
    await ctx.conversation.exitAll();
    await ctx.reply("Ритуал отменён.");
  });
}
