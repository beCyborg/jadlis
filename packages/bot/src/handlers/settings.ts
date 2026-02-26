import type { Bot, InlineKeyboard as IK } from "grammy";
import { InlineKeyboard } from "grammy";
import type { AuthedContext, BotContext } from "../bot";
import type { UserRepository } from "../repositories/userRepository";
import {
  scheduleUserNotifications,
  cancelUserNotifications,
  getUserSettingsFromRaw,
} from "../queue/scheduler";
import { isValidTimezone } from "@jadlis/shared";

let _userRepo: UserRepository | undefined;

function getUserRepo(): UserRepository {
  if (!_userRepo) throw new Error("initSettings() must be called before using settings handlers");
  return _userRepo;
}

export function initSettings(userRepo: UserRepository): void {
  _userRepo = userRepo;
}

function formatSettings(s: ReturnType<typeof getUserSettingsFromRaw>): string {
  const status = s.notifications_enabled ? "включены" : "выключены";
  return [
    "Настройки уведомлений:",
    `  Утро (НейроЗарядка): ${s.morning_neuro_charge_time}`,
    `  Вечер (Сканер): ${s.evening_scanner_time}`,
    `  Timezone: ${s.timezone}`,
    `  Уведомления: ${status}`,
  ].join("\n");
}

function settingsKeyboard(notificationsEnabled: boolean): IK {
  return new InlineKeyboard()
    .text("Изменить время утра", "settings:morning")
    .row()
    .text("Изменить время вечера", "settings:evening")
    .row()
    .text("Изменить timezone", "settings:timezone")
    .row()
    .text(
      notificationsEnabled ? "Отключить уведомления" : "Включить уведомления",
      "settings:toggle_notifications",
    );
}

async function handleSettingsCommand(ctx: BotContext): Promise<void> {
  const userId = (ctx as AuthedContext).userId;
  const user = await getUserRepo().findById(userId);

  if (!user) {
    await ctx.reply("Пользователь не найден. Попробуй /start");
    return;
  }

  const settings = getUserSettingsFromRaw(user.settings);
  await ctx.reply(formatSettings(settings), {
    reply_markup: settingsKeyboard(settings.notifications_enabled),
  });
}

async function handleSettingsCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const userId = (ctx as AuthedContext).userId;

  if (data === "settings:morning") {
    await ctx.editMessageText("Время утреннего ритуала (НейроЗарядка)?", {
      reply_markup: new InlineKeyboard()
        .text("06:00", "settings:morning:06:00")
        .text("07:00", "settings:morning:07:00")
        .text("08:00", "settings:morning:08:00")
        .text("09:00", "settings:morning:09:00"),
    });
    return;
  }

  if (data === "settings:evening") {
    await ctx.editMessageText("Время вечернего сканера?", {
      reply_markup: new InlineKeyboard()
        .text("20:00", "settings:evening:20:00")
        .text("21:00", "settings:evening:21:00")
        .text("22:00", "settings:evening:22:00"),
    });
    return;
  }

  if (data === "settings:timezone") {
    await ctx.editMessageText("Выберите часовой пояс:", {
      reply_markup: new InlineKeyboard()
        .text("Europe/Moscow", "settings:timezone:Europe/Moscow")
        .text("Europe/Berlin", "settings:timezone:Europe/Berlin")
        .row()
        .text("Europe/London", "settings:timezone:Europe/London")
        .text("America/New_York", "settings:timezone:America/New_York")
        .row()
        .text("Asia/Tokyo", "settings:timezone:Asia/Tokyo")
        .text("Asia/Shanghai", "settings:timezone:Asia/Shanghai")
        .row()
        .text("Другой (ввести вручную)", "settings:tz_manual"),
    });
    return;
  }

  if (data === "settings:tz_manual") {
    ctx.session.settings_awaiting_tz = true;
    await ctx.editMessageText(
      "Введите IANA timezone (например: Europe/Moscow, America/Chicago):",
    );
    return;
  }

  // Parse value updates
  const morningMatch = data.match(/^settings:morning:(\d{2}:\d{2})$/);
  if (morningMatch) {
    await saveAndReschedule(ctx, userId, {
      morning_neuro_charge_time: morningMatch[1],
    });
    return;
  }

  const eveningMatch = data.match(/^settings:evening:(\d{2}:\d{2})$/);
  if (eveningMatch) {
    await saveAndReschedule(ctx, userId, {
      evening_scanner_time: eveningMatch[1],
    });
    return;
  }

  const tzMatch = data.match(/^settings:timezone:(.+)$/);
  if (tzMatch) {
    await saveAndReschedule(ctx, userId, { timezone: tzMatch[1] });
    return;
  }

  if (data === "settings:toggle_notifications") {
    const user = await getUserRepo().findById(userId);
    if (!user) return;

    const current = getUserSettingsFromRaw(user.settings);
    const newEnabled = !current.notifications_enabled;

    if (newEnabled) {
      await saveAndReschedule(ctx, userId, { notifications_enabled: true });
    } else {
      await getUserRepo().mergeSettings(userId, { notifications_enabled: false });
      const telegramId = Number(user.telegram_id);
      await cancelUserNotifications(telegramId);

      const updated = { ...current, notifications_enabled: false };
      await ctx.editMessageText(formatSettings(updated), {
        reply_markup: settingsKeyboard(false),
      });
    }
    return;
  }
}

export async function handleSettingsText(
  ctx: BotContext,
  next: () => Promise<void>,
): Promise<void> {
  if (!ctx.session.settings_awaiting_tz) return next();

  const tz = ctx.message?.text?.trim();
  if (!tz || !isValidTimezone(tz)) {
    await ctx.reply(
      "Неверный timezone. Введите корректный IANA timezone (например: Europe/Moscow):",
    );
    return;
  }

  ctx.session.settings_awaiting_tz = false;
  const userId = (ctx as AuthedContext).userId;
  await saveAndReschedule(ctx, userId, { timezone: tz });
}

async function saveAndReschedule(
  ctx: BotContext,
  userId: string,
  partial: Record<string, unknown>,
): Promise<void> {
  const merged = await getUserRepo().mergeSettings(userId, partial);
  if (!merged) return;

  const user = await getUserRepo().findById(userId);
  if (!user) return;

  const telegramId = Number(user.telegram_id);
  const settings = getUserSettingsFromRaw(merged);
  await scheduleUserNotifications(telegramId, telegramId, settings);

  await ctx.editMessageText(formatSettings(settings), {
    reply_markup: settingsKeyboard(settings.notifications_enabled),
  });
}

export function registerSettingsHandler(bot: Bot<BotContext>): void {
  bot.command("settings", handleSettingsCommand);
  bot.callbackQuery(/^settings:/, handleSettingsCallback);
}
