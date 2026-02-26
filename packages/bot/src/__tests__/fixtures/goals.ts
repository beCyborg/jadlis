import type { Goal } from "@jadlis/shared";

const nextWeek = new Date(Date.now() + 7 * 86_400_000);
const nextMonth = new Date(Date.now() + 30 * 86_400_000);
const farFuture = new Date(Date.now() + 90 * 86_400_000);

export const sampleActiveGoals: Goal[] = [
  {
    id: "goal-1",
    user_id: "user-1",
    title: "Выпустить MVP бота",
    description: "Запустить первую версию Jadlis",
    type: "achievement",
    status: "active",
    target_date: nextWeek,
    progress: 75,
    need_ids: ["need-career"],
  },
  {
    id: "goal-2",
    user_id: "user-1",
    title: "Пробежать полумарафон",
    description: "Подготовиться и пробежать 21 км",
    type: "physical",
    status: "active",
    target_date: nextMonth,
    progress: 40,
    need_ids: ["need-health", "need-fitness"],
  },
  {
    id: "goal-3",
    user_id: "user-1",
    title: "Выучить японский до N3",
    description: "Долгосрочная цель изучения языка",
    type: "achievement",
    status: "active",
    target_date: farFuture,
    progress: 15,
    need_ids: ["need-growth"],
  },
];
