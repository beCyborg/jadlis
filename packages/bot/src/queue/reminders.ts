import { getNotificationQueue } from "./notificationQueue";
import type { Api } from "grammy";

const REMINDER_DELAYS = [15 * 60 * 1000, 30 * 60 * 1000]; // 15 min, 30 min

/**
 * Schedules 2 reminder jobs (at +15min and +30min) for a given user + ritual type.
 * Job IDs are deterministic for cancellation.
 */
export async function scheduleReminders(
  userId: number,
  chatId: number,
  type: "neuro-charge" | "evening-scanner",
): Promise<void> {
  const queue = getNotificationQueue();

  for (let i = 0; i < REMINDER_DELAYS.length; i++) {
    await queue.add(
      `reminder-${userId}-${type}-${i + 1}`,
      {
        userId,
        chatId,
        type: "reminder",
        reminderNumber: (i + 1) as 1 | 2,
        originalType: type,
      },
      {
        delay: REMINDER_DELAYS[i],
        jobId: `reminder-${userId}-${type}-${i + 1}`,
      },
    );
  }
}

/**
 * Cancels all pending reminder jobs for a user + ritual type.
 */
export async function cancelReminders(
  userId: number,
  type: "neuro-charge" | "evening-scanner",
): Promise<void> {
  const queue = getNotificationQueue();

  for (let i = 1; i <= 2; i++) {
    const jobId = `reminder-${userId}-${type}-${i}`;
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }
}

/**
 * Records a missed ritual when user did not respond.
 * Still triggers the next step (e.g., morning checkin after missed neuro charge).
 */
export async function handleReminderTimeout(
  userId: number,
  chatId: number,
  type: "neuro-charge" | "evening-scanner",
  botApi: Api,
): Promise<void> {
  console.log(`[reminders] User ${userId} missed ritual: ${type}`);

  // If neuro charge was missed, still prompt morning checkin
  if (type === "neuro-charge") {
    await botApi.sendMessage(
      chatId,
      "НейроЗарядка пропущена. Переходим к утреннему чек-ину ☀️",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Начать →", callback_data: "morning_checkin:start" }],
          ],
        },
      },
    );
  }
}
