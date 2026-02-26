import type { Bot } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import type { BotContext } from "../bot";
import { createRedisStorage } from "./storage";
import { morningCheckin } from "./morningCheckin";
import { eveningScanner } from "./eveningScanner";

/** Conversation version — increment when conversation logic changes. */
const CONVERSATION_VERSION = 3;

/** Timeout for all conversations: 1 hour. */
const CONVERSATION_TIMEOUT_MS = 3_600_000;

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
    createConversation(morningCheckin, {
      id: "morningCheckin",
      maxMillisecondsToWait: CONVERSATION_TIMEOUT_MS,
    }),
  );

  bot.use(
    createConversation(eveningScanner, {
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
