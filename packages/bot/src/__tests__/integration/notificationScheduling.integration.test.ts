import { describe, test, expect, mock, beforeEach } from "bun:test";

/**
 * Integration test: Notification Scheduling
 * Tests the full lifecycle of notification scheduling.
 */

// Mock ioredis
const mockRedis = { disconnect: mock(() => {}), connect: mock(() => Promise.resolve()), status: "ready" };
mock.module("ioredis", () => ({ default: mock(() => mockRedis) }));

// Mock bullmq
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
} = await import("../../queue/scheduler");

const { _resetQueue } = await import("../../queue/notificationQueue");
const { resetRedisConnection } = await import("../../queue/connection");

describe("Notification Scheduling Integration", () => {
  beforeEach(() => {
    resetRedisConnection();
    _resetQueue();
    mockQueueInstance.upsertJobScheduler.mockClear();
    mockQueueInstance.removeJobScheduler.mockClear();
  });

  describe("Scenario 1: User completes onboarding → notifications scheduled", () => {
    test("creates both neuro-charge and evening-scanner cron jobs", async () => {
      await scheduleUserNotifications(100, 100, {
        timezone: "Europe/Moscow",
        morning_neuro_charge_time: "07:00",
        evening_scanner_time: "21:00",
        notifications_enabled: true,
      });

      expect(mockQueueInstance.upsertJobScheduler).toHaveBeenCalledTimes(2);

      const calls = mockQueueInstance.upsertJobScheduler.mock.calls as unknown as [string, { pattern: string; tz: string }][];
      const ids = calls.map(c => c[0]);
      expect(ids).toContain("neuro-charge-100");
      expect(ids).toContain("evening-scanner-100");
    });

    test("cron expression correct for user timezone and time", async () => {
      await scheduleUserNotifications(200, 200, {
        timezone: "Asia/Tokyo",
        morning_neuro_charge_time: "08:30",
        evening_scanner_time: "22:00",
        notifications_enabled: true,
      });

      const calls = mockQueueInstance.upsertJobScheduler.mock.calls as unknown as [string, { pattern: string; tz: string }][];

      const morningCall = calls.find(c => c[0] === "neuro-charge-200");
      expect(morningCall).toBeDefined();
      expect(morningCall![1].pattern).toBe("0 30 8 * * *");
      expect(morningCall![1].tz).toBe("Asia/Tokyo");

      const eveningCall = calls.find(c => c[0] === "evening-scanner-200");
      expect(eveningCall).toBeDefined();
      expect(eveningCall![1].pattern).toBe("0 0 22 * * *");
      expect(eveningCall![1].tz).toBe("Asia/Tokyo");
    });
  });

  describe("Scenario 2: Bot restarts → reconcileAllSchedules", () => {
    test("schedules for all users with notifications_enabled", async () => {
      const mockSupabase = {
        from: mock(() => ({
          select: mock(() => ({
            not: mock(() => ({
              filter: mock(() =>
                Promise.resolve({
                  data: [
                    { telegram_id: "101", settings: { notifications_enabled: true, timezone: "UTC" } },
                    { telegram_id: "102", settings: { notifications_enabled: true, timezone: "Europe/London" } },
                    { telegram_id: "103", settings: { notifications_enabled: true, timezone: "Asia/Tokyo" } },
                    { telegram_id: "104", settings: { notifications_enabled: true, timezone: "US/Eastern" } },
                    { telegram_id: "105", settings: { notifications_enabled: true } },
                  ],
                  error: null,
                }),
              ),
            })),
          })),
        })),
      };

      await reconcileAllSchedules(mockSupabase as never);
      // 5 users × 2 schedulers each = 10 calls
      expect(mockQueueInstance.upsertJobScheduler).toHaveBeenCalledTimes(10);
    });

    test("is idempotent — no duplicate scheduling", async () => {
      const mockSupabase = {
        from: mock(() => ({
          select: mock(() => ({
            not: mock(() => ({
              filter: mock(() =>
                Promise.resolve({
                  data: [
                    { telegram_id: "201", settings: { notifications_enabled: true } },
                  ],
                  error: null,
                }),
              ),
            })),
          })),
        })),
      };

      await reconcileAllSchedules(mockSupabase as never);
      await reconcileAllSchedules(mockSupabase as never);

      // Uses upsertJobScheduler → idempotent, 2 calls per run × 2 runs = 4
      expect(mockQueueInstance.upsertJobScheduler).toHaveBeenCalledTimes(4);
    });
  });

  describe("Scenario 3: User disables notifications", () => {
    test("removes both job schedulers", async () => {
      await cancelUserNotifications(300);

      expect(mockQueueInstance.removeJobScheduler).toHaveBeenCalledTimes(2);
      const calls = mockQueueInstance.removeJobScheduler.mock.calls as unknown as [string][];
      expect(calls[0][0]).toBe("neuro-charge-300");
      expect(calls[1][0]).toBe("evening-scanner-300");
    });
  });
});
