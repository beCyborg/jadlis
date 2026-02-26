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
import { registerNeuroChargeHandlers } from "./handlers/neuroCharge";
import { registerSettingsHandler, handleSettingsText, initSettings } from "./handlers/settings";
import { registerOnboardingHandler, handleOnboardingText, initOnboarding } from "./handlers/onboarding";
import { handleMorningCommand, handleEveningCommand } from "./handlers/manualTriggers";
import { supabase } from "./db";
import { UserRepository } from "./repositories/userRepository";

export type SessionData = {
  step: string;
  current_ritual: string | null;
  conversation_context: string;
  processing: boolean;
  working_memory_cache: string;
  working_memory_updated_at: string | null;
  message_count: number;
  onboarding_step?: "timezone" | "morning_time" | "evening_time" | "timezone_manual_input" | "done";
  onboarding_timezone?: string;
  onboarding_morning?: string;
  settings_awaiting_tz?: boolean;
};

export type BotContext = Context &
  SessionFlavor<SessionData> &
  ConversationFlavor<Context>;

/** Extended context available in handlers that run after authMiddleware. */
export type AuthedContext = BotContext & { userId: string };

export const bot = new Bot<BotContext>(process.env.BOT_TOKEN!);

// Initialize repositories for handlers
const userRepo = new UserRepository(supabase);
initSettings(userRepo);
initOnboarding(userRepo);

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
bot.command("morning", handleMorningCommand);
bot.command("evening", handleEveningCommand);

// Callback queries
registerNeuroChargeHandlers(bot);
registerSettingsHandler(bot);
registerOnboardingHandler(bot);

// Text messages (onboarding/settings text handlers run first, fall through to generic)
bot.on("message:text", handleOnboardingText);
bot.on("message:text", handleSettingsText);
bot.on("message:text", handleText);

// Error boundary — catch concurrent conversation attempts and unhandled errors
bot.catch((err) => {
  const { ctx, error } = err;
  if (error instanceof Error && error.message.includes("conversation")) {
    ctx.reply("Ритуал уже активен. Завершите текущий или введите /cancel для отмены.").catch(() => {});
    return;
  }
  console.error("[bot] Unhandled error:", error);
});
