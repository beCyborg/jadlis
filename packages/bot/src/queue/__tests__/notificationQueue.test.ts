import { describe, it, expect, mock, beforeEach } from "bun:test";
import { _getLastWorkerProcessor } from "../../../../../tests/preload";

const { createNotificationWorker, QUEUE_NAME, _resetQueue } = await import("../notificationQueue");
const { resetRedisConnection } = await import("../connection");

describe("QUEUE_NAME", () => {
  it("is 'jadlis-notifications'", () => {
    expect(QUEUE_NAME).toBe("jadlis-notifications");
  });
});

describe("createNotificationWorker", () => {
  let mockBotApi: { sendMessage: ReturnType<typeof mock> };

  beforeEach(() => {
    resetRedisConnection();
    _resetQueue();
    mockBotApi = {
      sendMessage: mock(() => Promise.resolve()),
    };
  });

  it("accepts botApi as dependency (no circular import)", () => {
    const worker = createNotificationWorker(mockBotApi as never);
    expect(worker).toBeDefined();
  });

  it("routes neuro-charge job to sendMessage with correct keyboard", async () => {
    createNotificationWorker(mockBotApi as never);
    const processor = _getLastWorkerProcessor();
    expect(processor).not.toBeNull();

    await processor!({
      data: { userId: 123, chatId: 456, type: "neuro-charge" },
    });

    expect(mockBotApi.sendMessage).toHaveBeenCalledTimes(1);
    const [chatId, text, opts] = mockBotApi.sendMessage.mock.calls[0];
    expect(chatId).toBe(456);
    expect(text).toContain("НейроЗарядку");
    expect(opts.reply_markup.inline_keyboard[0]).toHaveLength(2);
    expect(opts.reply_markup.inline_keyboard[0][0].callback_data).toBe("neuro_charge:done");
    expect(opts.reply_markup.inline_keyboard[0][1].callback_data).toBe("neuro_charge:skip");
  });

  it("routes evening-scanner job to sendMessage with correct keyboard", async () => {
    createNotificationWorker(mockBotApi as never);
    const processor = _getLastWorkerProcessor();

    await processor!({
      data: { userId: 123, chatId: 456, type: "evening-scanner" },
    });

    const [chatId, text, opts] = mockBotApi.sendMessage.mock.calls[0];
    expect(chatId).toBe(456);
    expect(text).toContain("вечернего сканера");
    expect(opts.reply_markup.inline_keyboard[0][0].callback_data).toBe("evening_scanner:start");
  });

  it("routes morning-checkin job to sendMessage with correct keyboard", async () => {
    createNotificationWorker(mockBotApi as never);
    const processor = _getLastWorkerProcessor();

    await processor!({
      data: { userId: 123, chatId: 456, type: "morning-checkin" },
    });

    const [, text, opts] = mockBotApi.sendMessage.mock.calls[0];
    expect(text).toContain("утреннему чек-ину");
    expect(opts.reply_markup.inline_keyboard[0][0].callback_data).toBe("morning_checkin:start");
  });

  it("routes reminder job to sendMessage with reminder text", async () => {
    createNotificationWorker(mockBotApi as never);
    const processor = _getLastWorkerProcessor();

    await processor!({
      data: { userId: 123, chatId: 456, type: "reminder", reminderNumber: 1 },
    });

    const [, text] = mockBotApi.sendMessage.mock.calls[0];
    expect(text).toContain("Напоминание");
  });

  it("throws UnrecoverableError for Telegram 4xx errors (except 429)", async () => {
    mockBotApi.sendMessage = mock(() => {
      const err = new Error("Bad Request") as Error & { error_code: number };
      err.error_code = 400;
      throw err;
    });

    createNotificationWorker(mockBotApi as never);
    const processor = _getLastWorkerProcessor();

    try {
      await processor!({
        data: { userId: 123, chatId: 456, type: "neuro-charge" },
      });
      expect(true).toBe(false); // should not reach
    } catch (err: unknown) {
      expect((err as Error).name).toBe("UnrecoverableError");
    }
  });

  it("does NOT throw UnrecoverableError for 429 (allows BullMQ retry)", async () => {
    mockBotApi.sendMessage = mock(() => {
      const err = new Error("Rate limited") as Error & { error_code: number };
      err.error_code = 429;
      throw err;
    });

    createNotificationWorker(mockBotApi as never);
    const processor = _getLastWorkerProcessor();

    try {
      await processor!({
        data: { userId: 123, chatId: 456, type: "neuro-charge" },
      });
      expect(true).toBe(false);
    } catch (err: unknown) {
      // Should be a regular Error, not UnrecoverableError
      expect((err as Error).name).not.toBe("UnrecoverableError");
      expect((err as Error).message).toContain("rate limited");
    }
  });
});
