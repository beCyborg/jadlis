import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock ioredis
const mockRedis = { disconnect: mock(() => {}), connect: mock(() => Promise.resolve()), status: "ready" };
mock.module("ioredis", () => ({ default: mock(() => mockRedis) }));

// Mock bullmq Queue
const mockQueueInstance = {
  add: mock(() => Promise.resolve()),
  upsertJobScheduler: mock(() => Promise.resolve()),
  removeJobScheduler: mock(() => Promise.resolve()),
  getJobCounts: mock(() => Promise.resolve({})),
  getJob: mock(() => Promise.resolve(null)),
};
mock.module("bullmq", () => ({
  Queue: mock(() => mockQueueInstance),
  Worker: mock(() => ({ on: mock(() => ({})) })),
  UnrecoverableError: class extends Error {},
}));

const {
  scheduleUserNotifications,
  cancelUserNotifications,
  reconcileAllSchedules,
  getUserSettingsFromRaw,
} = await import("../scheduler");

describe("getUserSettingsFromRaw", () => {
  it("returns defaults for null input", () => {
    const s = getUserSettingsFromRaw(null);
    expect(s.timezone).toBe("Europe/Moscow");
    expect(s.morning_neuro_charge_time).toBe("07:00");
    expect(s.evening_scanner_time).toBe("21:00");
    expect(s.notifications_enabled).toBe(true);
  });

  it("merges provided values over defaults", () => {
    const s = getUserSettingsFromRaw({
      timezone: "Asia/Tokyo",
      morning_neuro_charge_time: "06:30",
    });
    expect(s.timezone).toBe("Asia/Tokyo");
    expect(s.morning_neuro_charge_time).toBe("06:30");
    expect(s.evening_scanner_time).toBe("21:00"); // default
  });
});

describe("scheduleUserNotifications", () => {
  beforeEach(() => {
    mockQueueInstance.upsertJobScheduler.mockClear();
  });

  it("creates morning cron job with user timezone", async () => {
    await scheduleUserNotifications(123, 123, {
      timezone: "Europe/Moscow",
      morning_neuro_charge_time: "07:30",
      evening_scanner_time: "21:00",
      notifications_enabled: true,
    });

    expect(mockQueueInstance.upsertJobScheduler).toHaveBeenCalledTimes(2);
    const [schedulerId, opts] = mockQueueInstance.upsertJobScheduler.mock.calls[0];
    expect(schedulerId).toBe("neuro-charge-123");
    expect(opts.pattern).toBe("0 30 7 * * *");
    expect(opts.tz).toBe("Europe/Moscow");
  });

  it("creates evening cron job with user timezone", async () => {
    await scheduleUserNotifications(456, 456, {
      timezone: "Asia/Tokyo",
      morning_neuro_charge_time: "07:00",
      evening_scanner_time: "22:15",
      notifications_enabled: true,
    });

    const [schedulerId, opts] = mockQueueInstance.upsertJobScheduler.mock.calls[1];
    expect(schedulerId).toBe("evening-scanner-456");
    expect(opts.pattern).toBe("0 15 22 * * *");
    expect(opts.tz).toBe("Asia/Tokyo");
  });

  it("updates existing jobs (upsert, not duplicate)", async () => {
    // Call twice for same user
    const settings = {
      timezone: "UTC",
      morning_neuro_charge_time: "08:00",
      evening_scanner_time: "20:00",
      notifications_enabled: true,
    };
    await scheduleUserNotifications(789, 789, settings);
    await scheduleUserNotifications(789, 789, { ...settings, morning_neuro_charge_time: "09:00" });

    // All calls use upsertJobScheduler (idempotent)
    expect(mockQueueInstance.upsertJobScheduler).toHaveBeenCalledTimes(4);
  });
});

describe("cancelUserNotifications", () => {
  beforeEach(() => {
    mockQueueInstance.removeJobScheduler.mockClear();
  });

  it("removes all jobs for user", async () => {
    await cancelUserNotifications(123);
    expect(mockQueueInstance.removeJobScheduler).toHaveBeenCalledTimes(2);
    expect(mockQueueInstance.removeJobScheduler.mock.calls[0][0]).toBe("neuro-charge-123");
    expect(mockQueueInstance.removeJobScheduler.mock.calls[1][0]).toBe("evening-scanner-123");
  });
});

describe("reconcileAllSchedules", () => {
  beforeEach(() => {
    mockQueueInstance.upsertJobScheduler.mockClear();
  });

  it("loads users with notifications_enabled=true", async () => {
    const mockSupabase = {
      from: mock(() => ({
        select: mock(() => ({
          not: mock(() => ({
            filter: mock(() =>
              Promise.resolve({
                data: [
                  { telegram_id: "100", settings: { notifications_enabled: true, timezone: "UTC" } },
                  { telegram_id: "300", settings: { notifications_enabled: true, timezone: "Asia/Tokyo" } },
                ],
                error: null,
              }),
            ),
          })),
        })),
      })),
    };

    await reconcileAllSchedules(mockSupabase as never);
    // 2 users × 2 schedulers each = 4 calls
    expect(mockQueueInstance.upsertJobScheduler).toHaveBeenCalledTimes(4);
  });

  it("handles users returned by SQL filter", async () => {
    const mockSupabase = {
      from: mock(() => ({
        select: mock(() => ({
          not: mock(() => ({
            filter: mock(() =>
              Promise.resolve({
                data: [
                  { telegram_id: "100", settings: { notifications_enabled: true } },
                ],
                error: null,
              }),
            ),
          })),
        })),
      })),
    };

    await reconcileAllSchedules(mockSupabase as never);
    // 1 user × 2 schedulers = 2 calls
    expect(mockQueueInstance.upsertJobScheduler).toHaveBeenCalledTimes(2);
  });

  it("is idempotent (safe to run multiple times)", async () => {
    const mockSupabase = {
      from: mock(() => ({
        select: mock(() => ({
          not: mock(() => ({
            filter: mock(() =>
              Promise.resolve({
                data: [{ telegram_id: "100", settings: { notifications_enabled: true } }],
                error: null,
              }),
            ),
          })),
        })),
      })),
    };

    await reconcileAllSchedules(mockSupabase as never);
    await reconcileAllSchedules(mockSupabase as never);
    // Uses upsertJobScheduler → idempotent
    expect(mockQueueInstance.upsertJobScheduler).toHaveBeenCalledTimes(4);
  });
});
