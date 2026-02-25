import { Bot, type Context, type SessionFlavor } from "grammy";
import type { ConversationFlavor } from "@grammyjs/conversations";
import { errorBoundary } from "./middleware/error";
import { requestLogger } from "./middleware/logging";
import { createSessionMiddleware } from "./middleware/session";
import { dedupGuard } from "./middleware/dedup";
import { createAuthMiddleware } from "./middleware/auth";
import { setupConversations } from "./conversations";
import { createStartHandler } from "./handlers/start";
import { handleHelp } from "./handlers/help";
import { createStatusHandler } from "./handlers/status";
import { createGoalsHandler } from "./handlers/goals";
import { createHabitsHandler } from "./handlers/habits";
import { handleText } from "./handlers/text";
import { supabase } from "./db";

export type SessionData = {
  step: string;
  current_ritual: string | null;
  conversation_context: string;
  processing: boolean;
  working_memory_cache: string;
  working_memory_updated_at: string | null;
  message_count: number;
};

export type BotContext = Context &
  SessionFlavor<SessionData> &
  ConversationFlavor;

/** Extended context available in handlers that run after authMiddleware. */
export type AuthedContext = BotContext & { userId: string };

export const bot = new Bot<BotContext>(process.env.BOT_TOKEN!);

// Middleware chain (order is critical):
// error → logger → session → conversations → dedup → auth → handlers
bot.use(errorBoundary);
bot.use(requestLogger);
bot.use(createSessionMiddleware(supabase));
setupConversations(bot); // conversations plugin + /cancel command
bot.use(dedupGuard);
bot.use(createAuthMiddleware(supabase));

// Commands
bot.command("start", createStartHandler(supabase));
bot.command("help", handleHelp);
bot.command("status", createStatusHandler(supabase));
bot.command("goals", createGoalsHandler(supabase));
bot.command("habits", createHabitsHandler(supabase));

// Text messages
bot.on("message:text", handleText);
