import type { AuthedContext, BotContext } from "../bot";
import { isMorningCompleted, isEveningCompleted } from "../services/dayService";
import { supabase } from "../db";

/**
 * /morning command — manual trigger for morning check-in.
 * Skips НейроЗарядка, goes directly to morningCheckin conversation.
 * Includes duplicate ritual protection.
 */
export async function handleMorningCommand(ctx: BotContext): Promise<void> {
  const userId = (ctx as AuthedContext).userId;

  const completed = await isMorningCompleted(userId, supabase);
  if (completed) {
    await ctx.reply("Утренний чек-ин уже пройден сегодня ✓");
    return;
  }

  await ctx.conversation.enter("morningCheckin");
}

/**
 * /evening command — manual trigger for evening scanner.
 * Includes duplicate ritual protection.
 */
export async function handleEveningCommand(ctx: BotContext): Promise<void> {
  const userId = (ctx as AuthedContext).userId;

  const completed = await isEveningCompleted(userId, supabase);
  if (completed) {
    await ctx.reply("Вечерний сканер уже пройден сегодня ✓");
    return;
  }

  await ctx.conversation.enter("eveningScanner");
}
