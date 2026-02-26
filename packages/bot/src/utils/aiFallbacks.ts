import { levelToZone } from "@jadlis/shared";
import type { NeuroBalanceZone } from "@jadlis/shared";

/**
 * Formula-based zone fallback when AI is unavailable.
 * Maps average of 3 ratings (1-10 each) to zone level 1-7.
 */
export function fallbackZoneDetermination(
  physical: number,
  emotional: number,
  energy: number,
): { zone: NeuroBalanceZone; zoneLevel: number } {
  const average = (physical + emotional + energy) / 3;
  const zoneLevel = Math.max(1, Math.min(7, Math.round((average * 7) / 10)));
  return { zone: levelToZone(zoneLevel), zoneLevel };
}

export const PLAN_UNAVAILABLE_MESSAGE =
  "AI-анализ временно недоступен. Используйте /status для просмотра задач.";

/**
 * Auto-transfer all incomplete tasks to tomorrow when AI suggestion fails.
 */
export function fallbackTaskTransfer(
  incompleteTasks: Array<{ id: string; title: string }>,
): Array<{ taskId: string; action: string; reasoning: string }> {
  return incompleteTasks.map((t) => ({
    taskId: t.id,
    action: "transfer",
    reasoning: "AI недоступен, задачи перенесены автоматически",
  }));
}
