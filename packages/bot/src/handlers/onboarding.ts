import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import type { BotContext } from "../bot";
import type { UserRepository } from "../repositories/userRepository";
import {
  scheduleUserNotifications,
  getUserSettingsFromRaw,
} from "../queue/scheduler";
import { isValidTimezone } from "@jadlis/shared";

let _userRepo: UserRepository | undefined;

function getUserRepo(): UserRepository {
  if (!_userRepo) throw new Error("initOnboarding() must be called before using onboarding handlers");
  return _userRepo;
}

export function initOnboarding(userRepo: UserRepository): void {
  _userRepo = userRepo;
}

export async function startOnboarding(ctx: BotContext): Promise<void> {
  ctx.session.onboarding_step = "timezone";

  await ctx.reply(
    "Давайте настроим уведомления.\nВыберите ваш часовой пояс:",
    {
      reply_markup: new InlineKeyboard()
        .text("Europe/Moscow", "onboarding:tz:Europe/Moscow")
        .text("Europe/Berlin", "onboarding:tz:Europe/Berlin")
        .row()
        .text("Europe/London", "onboarding:tz:Europe/London")
        .text("America/New_York", "onboarding:tz:America/New_York")
        .row()
        .text("Asia/Tokyo", "onboarding:tz:Asia/Tokyo")
        .text("Asia/Shanghai", "onboarding:tz:Asia/Shanghai")
        .row()
        .text("Другой (ввести вручную)", "onboarding:tz_manual"),
    },
  );
}

async function handleOnboardingCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const tzMatch = data.match(/^onboarding:tz:(.+)$/);
  if (tzMatch) {
    ctx.session.onboarding_timezone = tzMatch[1];
    ctx.session.onboarding_step = "morning_time";

    await ctx.editMessageText("Время утреннего ритуала (НейроЗарядка)?", {
      reply_markup: new InlineKeyboard()
        .text("06:00", "onboarding:morning:06:00")
        .text("07:00", "onboarding:morning:07:00")
        .text("08:00", "onboarding:morning:08:00")
        .text("09:00", "onboarding:morning:09:00"),
    });
    return;
  }

  if (data === "onboarding:tz_manual") {
    ctx.session.onboarding_step = "timezone_manual_input";
    await ctx.editMessageText(
      "Введите IANA timezone (например: Europe/Moscow, America/Chicago):",
    );
    return;
  }

  const morningMatch = data.match(/^onboarding:morning:(\d{2}:\d{2})$/);
  if (morningMatch) {
    ctx.session.onboarding_morning = morningMatch[1];
    ctx.session.onboarding_step = "evening_time";

    await ctx.editMessageText("Время вечернего сканера?", {
      reply_markup: new InlineKeyboard()
        .text("20:00", "onboarding:evening:20:00")
        .text("21:00", "onboarding:evening:21:00")
        .text("22:00", "onboarding:evening:22:00"),
    });
    return;
  }

  const eveningMatch = data.match(/^onboarding:evening:(\d{2}:\d{2})$/);
  if (eveningMatch) {
    const timezone = ctx.session.onboarding_timezone ?? "Europe/Moscow";
    const morningTime = ctx.session.onboarding_morning ?? "07:00";
    const eveningTime = eveningMatch[1];

    await saveAndSchedule(ctx, {
      timezone,
      morning_neuro_charge_time: morningTime,
      evening_scanner_time: eveningTime,
      notifications_enabled: true,
    });
    return;
  }
}

export async function handleOnboardingText(
  ctx: BotContext,
  next: () => Promise<void>,
): Promise<void> {
  if (ctx.session.onboarding_step !== "timezone_manual_input") return next();

  const tz = ctx.message?.text?.trim();
  if (!tz || !isValidTimezone(tz)) {
    await ctx.reply(
      "Неверный timezone. Введите корректный IANA timezone (например: Europe/Moscow):",
    );
    return;
  }

  ctx.session.onboarding_timezone = tz;
  ctx.session.onboarding_step = "morning_time";

  await ctx.reply("Время утреннего ритуала (НейроЗарядка)?", {
    reply_markup: new InlineKeyboard()
      .text("06:00", "onboarding:morning:06:00")
      .text("07:00", "onboarding:morning:07:00")
      .text("08:00", "onboarding:morning:08:00")
      .text("09:00", "onboarding:morning:09:00"),
  });
}

async function saveAndSchedule(
  ctx: BotContext,
  settingsRaw: Record<string, unknown>,
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await getUserRepo().findByTelegramId(telegramId);
  if (!user) return;

  await getUserRepo().updateSettings(user.id, settingsRaw);

  const settings = getUserSettingsFromRaw(settingsRaw);
  await scheduleUserNotifications(telegramId, telegramId, settings);

  ctx.session.onboarding_step = "done";

  const morningTime = settingsRaw.morning_neuro_charge_time ?? "07:00";
  await ctx.editMessageText(
    `Уведомления настроены! Первая НейроЗарядка придёт в ${morningTime}.`,
  );
}

export function registerOnboardingHandler(bot: Bot<BotContext>): void {
  bot.callbackQuery(/^onboarding:/, handleOnboardingCallback);
}
