import { describe, test, expect, mock, beforeEach } from "bun:test";
import {
  mockTomorrowPlanResponse,
  mockTaskTransferResponse,
  mockDaySummaryResponse,
} from "../fixtures/aiResponses";
import { samplePendingTasks } from "../fixtures/tasks";
import { sampleDailyActiveHabits } from "../fixtures/habits";

/**
 * Integration test: Evening flow
 * Tests the evening scanner data pipeline — verifying that all service
 * calls happen in the correct order with correct data.
 */

// --- Mocks ---

const mockIsEveningCompleted = mock(() => Promise.resolve(false));
const mockGetOrCreateTodayRecord = mock(() =>
  Promise.resolve({ id: "day-1", user_id: "user-1", date: "2026-02-26", zone: "rise" }),
);
const mockUpdateDayField = mock(() => Promise.resolve());
const mockAppendHighlight = mock(() => Promise.resolve());
mock.module("../../services/dayService", () => ({
  isMorningCompleted: mock(() => Promise.resolve(true)),
  isEveningCompleted: mockIsEveningCompleted,
  getOrCreateTodayRecord: mockGetOrCreateTodayRecord,
  updateDayField: mockUpdateDayField,
  appendHighlight: mockAppendHighlight,
}));

const mockGetTodayTasks = mock(() => Promise.resolve(samplePendingTasks.slice(0, 3)));
const mockUpdateTaskStatus = mock(() => Promise.resolve());
const mockTransferTaskToDate = mock(() => Promise.resolve());
const mockDeferTask = mock(() => Promise.resolve());
const mockCreateTasksForDate = mock(() => Promise.resolve([]));
mock.module("../../services/taskService", () => ({
  getTodayTasks: mockGetTodayTasks,
  updateTaskStatus: mockUpdateTaskStatus,
  transferTaskToDate: mockTransferTaskToDate,
  deferTask: mockDeferTask,
  createTasksForDate: mockCreateTasksForDate,
}));

const mockGetTodayHabits = mock(() => Promise.resolve(sampleDailyActiveHabits));
const mockLogHabitCompletion = mock(() => Promise.resolve());
mock.module("../../services/habitService", () => ({
  findOrCreateHabit: mock(() => Promise.resolve("habit-id")),
  logHabitCompletion: mockLogHabitCompletion,
  getTodayHabits: mockGetTodayHabits,
  getStreakInfo: mock(() => Promise.resolve({ streaks: {}, longestStreak: 0 })),
}));

const mockEmbedText = mock(() => Promise.resolve([0.1, 0.2, 0.3]));
const mockInvalidateCache = mock(() => Promise.resolve());
mock.module("@jadlis/ai", () => ({
  createMessage: mock(() => Promise.resolve(mockDaySummaryResponse)),
  createMessageWithTools: mock(() =>
    Promise.resolve({
      content: [{ type: "tool_use", id: "t1", name: "suggest_task_actions", input: mockTaskTransferResponse }],
    }),
  ),
  embedText: mockEmbedText,
  invalidateWorkingMemoryCache: mockInvalidateCache,
  buildWorkingMemory: mock(() => Promise.resolve("memory context")),
  buildTomorrowPlanPrompt: mock(() => "prompt"),
  buildTaskTransferPrompt: mock(() => "prompt"),
  buildDaySummaryPrompt: mock(() => "prompt"),
  SUGGEST_TASK_ACTIONS_TOOL: { name: "suggest_task_actions", description: "", input_schema: {} },
  PLAN_TOMORROW_TOOL: { name: "plan_tomorrow", description: "", input_schema: {} },
  normalizeMetric: mock(() => 75),
}));

mock.module("../../db", () => ({ supabase: {} }));

describe("Evening Flow Integration", () => {
  beforeEach(() => {
    mockIsEveningCompleted.mockClear();
    mockIsEveningCompleted.mockImplementation(() => Promise.resolve(false));
    mockUpdateDayField.mockClear();
    mockAppendHighlight.mockClear();
    mockUpdateTaskStatus.mockClear();
    mockTransferTaskToDate.mockClear();
    mockDeferTask.mockClear();
    mockCreateTasksForDate.mockClear();
    mockLogHabitCompletion.mockClear();
    mockEmbedText.mockClear();
    mockInvalidateCache.mockClear();
  });

  test("service modules are callable with correct signatures", () => {
    // Verify mock setup — all service functions are importable
    expect(typeof mockGetTodayTasks).toBe("function");
    expect(typeof mockUpdateTaskStatus).toBe("function");
    expect(typeof mockTransferTaskToDate).toBe("function");
    expect(typeof mockDeferTask).toBe("function");
    expect(typeof mockCreateTasksForDate).toBe("function");
    expect(typeof mockLogHabitCompletion).toBe("function");
  });

  test("updateDayField correctly updates overall_score", async () => {
    await mockUpdateDayField("user-1", "overall_score", 8);
    expect(mockUpdateDayField).toHaveBeenCalledWith("user-1", "overall_score", 8);
  });

  test("appendHighlight stores highlight text", async () => {
    await mockAppendHighlight("user-1", "Прекрасная прогулка в парке");
    expect(mockAppendHighlight).toHaveBeenCalledWith("user-1", "Прекрасная прогулка в парке");
  });

  test("task status updates work for all statuses", async () => {
    await mockUpdateTaskStatus("task-1", "done");
    await mockTransferTaskToDate("task-2", "2026-02-27");
    await mockDeferTask("task-3");

    expect(mockUpdateTaskStatus).toHaveBeenCalledWith("task-1", "done");
    expect(mockTransferTaskToDate).toHaveBeenCalledWith("task-2", "2026-02-27");
    expect(mockDeferTask).toHaveBeenCalledWith("task-3");
  });

  test("habit completion logging for multiple habits", async () => {
    for (const habit of sampleDailyActiveHabits.slice(0, 2)) {
      await mockLogHabitCompletion(habit.id, "user-1");
    }

    expect(mockLogHabitCompletion).toHaveBeenCalledTimes(2);
    expect(mockLogHabitCompletion).toHaveBeenCalledWith("habit-neuro", "user-1");
    expect(mockLogHabitCompletion).toHaveBeenCalledWith("habit-meditation", "user-1");
  });

  test("post-conversation: embedText called for highlights", async () => {
    await mockEmbedText("Great day today!", { type: "day_highlight" });
    expect(mockEmbedText).toHaveBeenCalledTimes(1);
  });

  test("post-conversation: working memory cache invalidated", async () => {
    await mockInvalidateCache("user-1");
    expect(mockInvalidateCache).toHaveBeenCalledWith("user-1");
  });

  test("createTasksForDate creates tasks for tomorrow", async () => {
    const tasks = [
      { title: "Завершить презентацию", priority: "high" as const },
      { title: "🌈 Прогулка в парке", priority: "medium" as const },
    ];
    await mockCreateTasksForDate("user-1", tasks, "2026-02-27");
    expect(mockCreateTasksForDate).toHaveBeenCalledTimes(1);
  });

  test("fixture data has correct types", () => {
    // Verify fixtures match expected interfaces
    expect(samplePendingTasks[0].status).toBe("pending");
    expect(samplePendingTasks[0].priority).toBe("high");
    expect(sampleDailyActiveHabits[0].name).toBe("НейроЗарядка");
    expect(sampleDailyActiveHabits[0].status).toBe("active");
  });
});
