import { getNotificationQueue } from "./notificationQueue";
import type { NotificationJobData } from "./notificationQueue";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserSettings {
  timezone: string;
  morning_neuro_charge_time: string; // "HH:MM"
  evening_scanner_time: string; // "HH:MM"
  notifications_enabled: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  timezone: "Europe/Moscow",
  morning_neuro_charge_time: "07:00",
  evening_scanner_time: "21:00",
  notifications_enabled: true,
};

export function getUserSettingsFromRaw(
  raw: Record<string, unknown> | null,
): UserSettings {
  return {
    timezone:
      (raw?.timezone as string) ?? DEFAULT_SETTINGS.timezone,
    morning_neuro_charge_time:
      (raw?.morning_neuro_charge_time as string) ??
      DEFAULT_SETTINGS.morning_neuro_charge_time,
    evening_scanner_time:
      (raw?.evening_scanner_time as string) ??
      DEFAULT_SETTINGS.evening_scanner_time,
    notifications_enabled:
      raw?.notifications_enabled !== undefined
        ? Boolean(raw.notifications_enabled)
        : DEFAULT_SETTINGS.notifications_enabled,
  };
}

function timeToCron(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  // BullMQ uses 6-part seconds-aware cron
  return `0 ${minute} ${hour} * * *`;
}

/**
 * Creates or updates BullMQ Job Schedulers for a user's morning and evening notifications.
 * Uses upsertJobScheduler to avoid creating duplicates.
 */
export async function scheduleUserNotifications(
  userId: number,
  chatId: number,
  settings: UserSettings,
): Promise<void> {
  const queue = getNotificationQueue();

  const morningCron = timeToCron(settings.morning_neuro_charge_time);
  const eveningCron = timeToCron(settings.evening_scanner_time);

  await queue.upsertJobScheduler(
    `neuro-charge-${userId}`,
    {
      pattern: morningCron,
      tz: settings.timezone,
    },
    {
      name: `neuro-charge-${userId}`,
      data: {
        userId,
        chatId,
        type: "neuro-charge" as const,
      },
    },
  );

  await queue.upsertJobScheduler(
    `evening-scanner-${userId}`,
    {
      pattern: eveningCron,
      tz: settings.timezone,
    },
    {
      name: `evening-scanner-${userId}`,
      data: {
        userId,
        chatId,
        type: "evening-scanner" as const,
      },
    },
  );
}

/**
 * Removes all scheduled notification jobs for a user.
 */
export async function cancelUserNotifications(
  userId: number,
): Promise<void> {
  const queue = getNotificationQueue();
  await queue.removeJobScheduler(`neuro-charge-${userId}`);
  await queue.removeJobScheduler(`evening-scanner-${userId}`);
}

/**
 * Startup reconciliation: loads all users with notifications_enabled
 * and upserts their schedules. Idempotent.
 */
export async function reconcileAllSchedules(
  supabase: SupabaseClient,
): Promise<void> {
  const { data: users, error } = await supabase
    .from("users")
    .select("telegram_id, settings")
    .not("settings", "is", null)
    .filter("settings->>notifications_enabled", "eq", "true");

  if (error) {
    console.error("[scheduler] Failed to load users for reconciliation:", error);
    return;
  }

  let count = 0;
  for (const user of users ?? []) {
    const settings = getUserSettingsFromRaw(
      user.settings as Record<string, unknown>,
    );
    if (!settings.notifications_enabled) continue;

    const telegramId = Number(user.telegram_id);
    // chatId === telegramId for private chats
    await scheduleUserNotifications(telegramId, telegramId, settings);
    count++;
  }

  console.log(`[scheduler] Reconciled ${count} user schedules`);
}
