import { Queue, Worker, UnrecoverableError } from "bullmq";
import type { Api } from "grammy";
import { getRedisConnection } from "./connection";
import { scheduleReminders } from "./reminders";

export const QUEUE_NAME = "jadlis-notifications";

export type NotificationJobType =
  | "neuro-charge"
  | "morning-checkin"
  | "evening-scanner"
  | "reminder";

export type RitualType = "neuro-charge" | "evening-scanner";

export interface NotificationJobData {
  userId: number;
  chatId: number;
  type: NotificationJobType;
  reminderNumber?: 1 | 2;
  /** Original ritual type for reminder jobs (to show correct keyboard). */
  originalType?: RitualType;
}

const MESSAGES: Record<string, string> = {
  "neuro-charge": "Пора сделать НейроЗарядку! 🧠",
  "morning-checkin": "Готовы к утреннему чек-ину? ☀️",
  "evening-scanner": "Время вечернего сканера 🌙",
};

function getReminderMessage(num: 1 | 2): string {
  return num === 1
    ? "Напоминание: ещё есть время пройти ритуал"
    : "Последнее напоминание на сегодня";
}

function getKeyboard(type: NotificationJobType, originalType?: RitualType) {
  if (type === "reminder" && originalType) {
    // Reminder keyboard matches the original notification type
    return getKeyboard(originalType);
  }

  switch (type) {
    case "neuro-charge":
      return {
        inline_keyboard: [
          [
            { text: "Готово ✓", callback_data: "neuro_charge:done" },
            { text: "Пропускаю →", callback_data: "neuro_charge:skip" },
          ],
        ],
      };
    case "morning-checkin":
      return {
        inline_keyboard: [
          [{ text: "Начать →", callback_data: "morning_checkin:start" }],
        ],
      };
    case "evening-scanner":
      return {
        inline_keyboard: [
          [{ text: "Начать →", callback_data: "evening_scanner:start" }],
        ],
      };
  }
}

export function createNotificationQueue(): Queue<NotificationJobData> {
  return new Queue<NotificationJobData>(QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  });
}

let queueInstance: Queue<NotificationJobData> | null = null;

export function getNotificationQueue(): Queue<NotificationJobData> {
  if (!queueInstance) {
    queueInstance = createNotificationQueue();
  }
  return queueInstance;
}

/**
 * Creates a BullMQ Worker with botApi injected (DI pattern).
 * Worker does NOT import bot.ts — avoids circular imports.
 */
export function createNotificationWorker(
  botApi: Api,
): Worker<NotificationJobData> {
  return new Worker<NotificationJobData>(
    QUEUE_NAME,
    async (job) => {
      const { chatId, type, reminderNumber, originalType } = job.data;

      const text =
        type === "reminder"
          ? getReminderMessage(reminderNumber ?? 1)
          : MESSAGES[type];

      const keyboard = getKeyboard(type, originalType);

      try {
        await botApi.sendMessage(chatId, text, {
          reply_markup: keyboard,
        });

        // Schedule follow-up reminders for ritual notifications
        if (type === "neuro-charge" || type === "evening-scanner") {
          const { userId } = job.data;
          await scheduleReminders(userId, chatId, type);
        }
      } catch (err: unknown) {
        if (
          err &&
          typeof err === "object" &&
          "error_code" in err &&
          typeof (err as Record<string, unknown>).error_code === "number"
        ) {
          const code = (err as Record<string, number>).error_code;
          // 429 = rate limit → let BullMQ retry with backoff
          if (code === 429) {
            throw new Error(`Telegram rate limited: ${code}`);
          }
          // Other 4xx → unrecoverable, do not retry
          if (code >= 400 && code < 500) {
            throw new UnrecoverableError(
              `Telegram client error: ${code}`,
            );
          }
        }
        throw err;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 10,
    },
  );
}
