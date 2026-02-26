import { describe, it, expect, mock, beforeEach } from "bun:test";
import { _resetQueue, _setQueueForTest } from "../notificationQueue";
import {
  scheduleUserNotifications,
  cancelUserNotifications,
  reconcileAllSchedules,
  getUserSettingsFromRaw,
} from "../scheduler";

// Mock queue instance (injected via _setQueueForTest)
const mockQueueInstance = {
  add: mock(() => Promise.resolve()),
  upsertJobScheduler: mock(() => Promise.resolve()),
  removeJobScheduler: mock(() => Promise.resolve()),
  getJobCounts: mock(() => Promise.resolve({})),
  getJob: mock(() => Promise.resolve(null)),
};

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
    _resetQueue();
    _setQueueForTest(mockQueueInstance);
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
    const call0 = mockQueueInstance.upsertJobScheduler.mock.calls[0] as unknown as [string, { pattern: string; tz: string }];
    expect(call0[0]).toBe("neuro-charge-123");
    expect(call0[1].pattern).toBe("0 30 7 * * *");
    expect(call0[1].tz).toBe("Europe/Moscow");
  });

  it("creates evening cron job with user timezone", async () => {
    await scheduleUserNotifications(456, 456, {
      timezone: "Asia/Tokyo",
      morning_neuro_charge_time: "07:00",
      evening_scanner_time: "22:15",
      notifications_enabled: true,
    });

    const call1 = mockQueueInstance.upsertJobScheduler.mock.calls[1] as unknown as [string, { pattern: string; tz: string }];
    expect(call1[0]).toBe("evening-scanner-456");
    expect(call1[1].pattern).toBe("0 15 22 * * *");
    expect(call1[1].tz).toBe("Asia/Tokyo");
  });

  it("updates existing jobs (upsert, not duplicate)", async () => {
    const settings = {
      timezone: "UTC",
      morning_neuro_charge_time: "08:00",
      evening_scanner_time: "20:00",
      notifications_enabled: true,
    };
    await scheduleUserNotifications(789, 789, settings);
    await scheduleUserNotifications(789, 789, { ...settings, morning_neuro_charge_time: "09:00" });

    expect(mockQueueInstance.upsertJobScheduler).toHaveBeenCalledTimes(4);
  });
});

describe("cancelUserNotifications", () => {
  beforeEach(() => {
    _resetQueue();
    _setQueueForTest(mockQueueInstance);
    mockQueueInstance.removeJobScheduler.mockClear();
  });

  it("removes all jobs for user", async () => {
    await cancelUserNotifications(123);
    expect(mockQueueInstance.removeJobScheduler).toHaveBeenCalledTimes(2);
    expect((mockQueueInstance.removeJobScheduler.mock.calls[0] as unknown as [string])[0]).toBe("neuro-charge-123");
    expect((mockQueueInstance.removeJobScheduler.mock.calls[1] as unknown as [string])[0]).toBe("evening-scanner-123");
  });
});

describe("reconcileAllSchedules", () => {
  beforeEach(() => {
    _resetQueue();
    _setQueueForTest(mockQueueInstance);
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
    expect(mockQueueInstance.upsertJobScheduler).toHaveBeenCalledTimes(4);
  });
});
