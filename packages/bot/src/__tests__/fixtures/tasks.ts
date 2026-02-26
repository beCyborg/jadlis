import type { Task } from "@jadlis/shared";

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

export const samplePendingTasks: Task[] = [
  {
    id: "task-1",
    user_id: "user-1",
    stage_id: null,
    title: "Подготовить презентацию",
    status: "pending",
    priority: "high",
    due_date: today,
    external_id: null,
  },
  {
    id: "task-2",
    user_id: "user-1",
    stage_id: null,
    title: "Написать тесты для API",
    status: "pending",
    priority: "medium",
    due_date: today,
    external_id: null,
  },
  {
    id: "task-3",
    user_id: "user-1",
    stage_id: null,
    title: "Прочитать главу книги",
    status: "pending",
    priority: "low",
    due_date: today,
    external_id: null,
  },
  {
    id: "task-4",
    user_id: "user-1",
    stage_id: null,
    title: "Дедлайн через неделю",
    status: "in_progress",
    priority: "high",
    due_date: nextWeek,
    external_id: null,
  },
];

export const sampleCompletedTasks: Task[] = [
  {
    id: "task-done-1",
    user_id: "user-1",
    stage_id: null,
    title: "Утренняя пробежка",
    status: "done",
    priority: "medium",
    due_date: today,
    external_id: null,
  },
  {
    id: "task-done-2",
    user_id: "user-1",
    stage_id: null,
    title: "Позвонить маме",
    status: "done",
    priority: "low",
    due_date: today,
    external_id: null,
  },
];

export const sampleDeferredTasks: Task[] = [
  {
    id: "task-deferred-1",
    user_id: "user-1",
    stage_id: null,
    title: "Разобрать гараж",
    status: "deferred",
    priority: "low",
    due_date: null,
    external_id: null,
  },
  {
    id: "task-cancelled-1",
    user_id: "user-1",
    stage_id: null,
    title: "Отменённое задание",
    status: "cancelled",
    priority: "low",
    due_date: null,
    external_id: null,
  },
];

export const sampleTomorrowTasks: Task[] = [
  {
    id: "task-tmrw-1",
    user_id: "user-1",
    stage_id: null,
    title: "Задача на завтра",
    status: "pending",
    priority: "medium",
    due_date: tomorrow,
    external_id: null,
  },
];
