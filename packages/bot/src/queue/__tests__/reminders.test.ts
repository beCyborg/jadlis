import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock ioredis
const mockRedis = { disconnect: mock(() => {}), status: "ready" };
mock.module("ioredis", () => ({ default: mock(() => mockRedis) }));

// Mock the notificationQueue module directly (avoids singleton issues)
const mockQueueAdd = mock((_name: string, _data: unknown, _opts?: unknown) => Promise.resolve());
const mockJobs: Record<string, { remove: ReturnType<typeof mock> }> = {};
const mockQueueGetJob = mock((id: string) => Promise.resolve(mockJobs[id] ?? null));

mock.module("../notificationQueue", () => ({
  getNotificationQueue: () => ({
    add: mockQueueAdd,
    getJob: mockQueueGetJob,
  }),
}));

const { scheduleReminders, cancelReminders, handleReminderTimeout } = await import("../reminders");

describe("scheduleReminders", () => {
  beforeEach(() => {
    mockQueueAdd.mockClear();
    for (const key of Object.keys(mockJobs)) delete mockJobs[key];
  });

  it("creates 2 delayed jobs (15 min, 30 min)", async () => {
    await scheduleReminders(123, 456, "neuro-charge");
    expect(mockQueueAdd).toHaveBeenCalledTimes(2);

    const call1 = mockQueueAdd.mock.calls[0];
    expect(call1[2].delay).toBe(15 * 60 * 1000);
    expect(call1[2].jobId).toBe("reminder-123-neuro-charge-1");

    const call2 = mockQueueAdd.mock.calls[1];
    expect(call2[2].delay).toBe(30 * 60 * 1000);
    expect(call2[2].jobId).toBe("reminder-123-neuro-charge-2");
  });
});

describe("cancelReminders", () => {
  beforeEach(() => {
    mockQueueGetJob.mockClear();
    for (const key of Object.keys(mockJobs)) delete mockJobs[key];
  });

  it("removes pending reminder jobs by userId + type", async () => {
    // Create mock jobs that getJob will find
    mockJobs["reminder-123-neuro-charge-1"] = { remove: mock(() => Promise.resolve()) };
    mockJobs["reminder-123-neuro-charge-2"] = { remove: mock(() => Promise.resolve()) };

    await cancelReminders(123, "neuro-charge");
    expect(mockQueueGetJob).toHaveBeenCalledTimes(2);
    expect(mockQueueGetJob.mock.calls[0][0]).toBe("reminder-123-neuro-charge-1");
    expect(mockQueueGetJob.mock.calls[1][0]).toBe("reminder-123-neuro-charge-2");
    expect(mockJobs["reminder-123-neuro-charge-1"].remove).toHaveBeenCalledTimes(1);
    expect(mockJobs["reminder-123-neuro-charge-2"].remove).toHaveBeenCalledTimes(1);
  });
});

describe("handleReminderTimeout", () => {
  it("records missed ritual when no response", async () => {
    const mockBotApi = {
      sendMessage: mock(() => Promise.resolve()),
    };

    // Should not throw
    await handleReminderTimeout(123, 456, "evening-scanner", mockBotApi as never);
  });

  it("still triggers next step (morning checkin after neuro charge)", async () => {
    const mockBotApi = {
      sendMessage: mock(() => Promise.resolve()),
    };

    await handleReminderTimeout(123, 456, "neuro-charge", mockBotApi as never);

    expect(mockBotApi.sendMessage).toHaveBeenCalledTimes(1);
    const [chatId, text, opts] = mockBotApi.sendMessage.mock.calls[0];
    expect(chatId).toBe(456);
    expect(text).toContain("утреннему чек-ину");
    expect(opts.reply_markup.inline_keyboard[0][0].callback_data).toBe("morning_checkin:start");
  });
});
