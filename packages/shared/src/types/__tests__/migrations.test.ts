import { describe, test, expect } from "bun:test";
import type { NeuroBalanceZone, TaskStatus, HabitStatus } from "../index";
import { ZONE_LEVEL } from "../day";

describe("type migrations", () => {
  describe("NeuroBalanceZone", () => {
    test("includes all 7 zones", () => {
      const zones: NeuroBalanceZone[] = [
        "crisis",
        "exhaustion",
        "decline",
        "stable",
        "rise",
        "flow",
        "superflow",
      ];
      expect(zones).toHaveLength(7);
    });

    test("ZONE_LEVEL maps all zones to levels 1-7", () => {
      expect(ZONE_LEVEL.crisis).toBe(1);
      expect(ZONE_LEVEL.exhaustion).toBe(2);
      expect(ZONE_LEVEL.decline).toBe(3);
      expect(ZONE_LEVEL.stable).toBe(4);
      expect(ZONE_LEVEL.rise).toBe(5);
      expect(ZONE_LEVEL.flow).toBe(6);
      expect(ZONE_LEVEL.superflow).toBe(7);
      expect(Object.keys(ZONE_LEVEL)).toHaveLength(7);
    });
  });

  describe("TaskStatus", () => {
    test("includes deferred and cancelled", () => {
      const statuses: TaskStatus[] = [
        "pending",
        "in_progress",
        "done",
        "deferred",
        "cancelled",
      ];
      expect(statuses).toHaveLength(5);
    });
  });

  describe("HabitStatus", () => {
    test("includes active, paused, archived", () => {
      const statuses: HabitStatus[] = ["active", "paused", "archived"];
      expect(statuses).toHaveLength(3);
    });
  });
});
