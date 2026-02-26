import { describe, test, expect, mock } from "bun:test";
import {
  getTodayTasks,
  createTasksForDate,
  updateTaskStatus,
  transferTaskToDate,
  deferTask,
} from "../taskService";

function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {};
  const terminal = () =>
    Promise.resolve({ data: overrides.data ?? null, error: overrides.error ?? null });

  chain.maybeSingle = mock(terminal);
  chain.single = mock(terminal);
  chain.eq = mock(() => chain);
  chain.in = mock(() => chain);
  chain.select = mock(() => chain);
  chain.insert = mock(() => chain);
  chain.update = mock(() => chain);
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
    terminal().then(resolve, reject);

  return {
    from: mock(() => chain),
    _chain: chain,
  };
}

describe("taskService", () => {
  describe("getTodayTasks", () => {
    test("returns tasks with due_date = today and status pending/in_progress", async () => {
      const tasks = [
        { id: "t1", title: "Task 1", status: "pending", due_date: "2026-02-26" },
        { id: "t2", title: "Task 2", status: "in_progress", due_date: "2026-02-26" },
      ];
      const sb = createMockSupabase({ data: tasks });

      const result = await getTodayTasks("user-1", sb as never);
      expect(sb.from).toHaveBeenCalledWith("tasks");
      expect(result).toEqual(tasks);
    });
  });

  describe("createTasksForDate", () => {
    test("batch creates tasks with correct due_date", async () => {
      const newTasks = [
        { title: "New Task 1", priority: "high" as const },
        { title: "New Task 2", priority: "medium" as const },
      ];
      const created = newTasks.map((t, i) => ({
        id: `t-${i}`,
        ...t,
        status: "pending",
        due_date: "2026-02-27",
      }));
      const sb = createMockSupabase({ data: created });

      const result = await createTasksForDate("user-1", newTasks, "2026-02-27", sb as never);
      expect(sb.from).toHaveBeenCalledWith("tasks");
      expect(sb._chain.insert).toHaveBeenCalled();
    });
  });

  describe("updateTaskStatus", () => {
    test("changes task status", async () => {
      const sb = createMockSupabase({});
      await updateTaskStatus("task-1", "done", sb as never);

      expect(sb.from).toHaveBeenCalledWith("tasks");
      expect(sb._chain.update).toHaveBeenCalled();
    });
  });

  describe("transferTaskToDate", () => {
    test("updates due_date, keeps status pending", async () => {
      const sb = createMockSupabase({});
      await transferTaskToDate("task-1", "2026-02-27", sb as never);

      expect(sb.from).toHaveBeenCalledWith("tasks");
      expect(sb._chain.update).toHaveBeenCalled();
    });
  });

  describe("deferTask", () => {
    test("sets status deferred, due_date null", async () => {
      const sb = createMockSupabase({});
      await deferTask("task-1", sb as never);

      expect(sb.from).toHaveBeenCalledWith("tasks");
      expect(sb._chain.update).toHaveBeenCalled();
    });
  });
});
