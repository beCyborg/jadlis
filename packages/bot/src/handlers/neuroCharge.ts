import type { Bot } from "grammy";
import type { AuthedContext, BotContext } from "../bot";
import { cancelReminders } from "../queue/reminders";
import { isMorningCompleted } from "../services/dayService";
import { findOrCreateHabit, logHabitCompletion } from "../services/habitService";
import { supabase } from "../db";

const HABIT_NAME = "НейроЗарядка";

async function handleNeuroChargeDone(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const userId = (ctx as AuthedContext).userId;
  if (!ctx.from) return;
  const telegramId = ctx.from.id;

  const alreadyDone = await isMorningCompleted(userId, supabase);
  if (alreadyDone) {
    await ctx.reply("Утренний чек-ин уже пройден сегодня ✓");
    return;
  }

  try {
    const habitId = await findOrCreateHabit(userId, HABIT_NAME, supabase);
    await logHabitCompletion(habitId, userId, supabase);
  } catch (err) {
    console.warn("[neuroCharge] Failed to log habit:", err);
  }

  try {
    await cancelReminders(telegramId, "neuro-charge");
  } catch (err) {
    console.warn("[neuroCharge] Failed to cancel reminders:", err);
  }

  try {
    await ctx.conversation.enter("morningCheckin");
  } catch (err) {
    console.error("[neuroCharge] Failed to enter conversation:", err);
    await ctx.reply("Произошла ошибка, попробуйте /morning");
  }
}

async function handleNeuroChargeSkip(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const userId = (ctx as AuthedContext).userId;
  if (!ctx.from) return;
  const telegramId = ctx.from.id;

  const alreadyDone = await isMorningCompleted(userId, supabase);
  if (alreadyDone) {
    await ctx.reply("Утренний чек-ин уже пройден сегодня ✓");
    return;
  }

  try {
    await cancelReminders(telegramId, "neuro-charge");
  } catch (err) {
    console.warn("[neuroCharge] Failed to cancel reminders:", err);
  }

  try {
    await ctx.conversation.enter("morningCheckin");
  } catch (err) {
    console.error("[neuroCharge] Failed to enter conversation:", err);
    await ctx.reply("Произошла ошибка, попробуйте /morning");
  }
}

/**
 * Register neuro-charge callback handlers on the bot.
 * Handles neuro_charge:done and neuro_charge:skip callback queries.
 */
export function registerNeuroChargeHandlers(bot: Bot<BotContext>): void {
  bot.callbackQuery("neuro_charge:done", handleNeuroChargeDone);
  bot.callbackQuery("neuro_charge:skip", handleNeuroChargeSkip);
}
