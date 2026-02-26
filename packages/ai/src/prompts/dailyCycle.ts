import type Anthropic from "@anthropic-ai/sdk";
import type { NeuroBalanceZone } from "@jadlis/shared";

// ============================================================
// Types
// ============================================================

export interface ZoneDetermination {
  zone: NeuroBalanceZone;
  zoneLevel: number;
  reasoning: string;
}

// ============================================================
// Zone Display Helper
// ============================================================

export const ZONE_DISPLAY: Record<NeuroBalanceZone, { ru: string; level: number }> = {
  crisis:     { ru: "Кризис",        level: 1 },
  exhaustion: { ru: "Истощение",     level: 2 },
  decline:    { ru: "Спад",          level: 3 },
  stable:     { ru: "Стабильность",  level: 4 },
  rise:       { ru: "Подъём",        level: 5 },
  flow:       { ru: "Поток",         level: 6 },
  superflow:  { ru: "Суперпоток",    level: 7 },
};

// ============================================================
// Prompt Cacheability Annotations
// ============================================================

export const ZONE_PROMPT_CACHEABLE = true;
export const MORNING_PLAN_PROMPT_CACHEABLE = true;
export const TOMORROW_PLAN_PROMPT_CACHEABLE = true;
export const TASK_TRANSFER_PROMPT_CACHEABLE = false;
export const DAY_SUMMARY_PROMPT_CACHEABLE = false;

// ============================================================
// Tool Schemas
// ============================================================

export const DETERMINE_ZONE_TOOL: Anthropic.Messages.Tool = {
  name: "determine_zone",
  description:
    "Determine the user's NeuroBalance zone based on their morning ratings and context",
  input_schema: {
    type: "object" as const,
    properties: {
      zone: {
        type: "string",
        enum: [
          "crisis",
          "exhaustion",
          "decline",
          "stable",
          "rise",
          "flow",
          "superflow",
        ],
        description: "The determined NeuroBalance zone name",
      },
      zoneLevel: {
        type: "integer",
        minimum: 1,
        maximum: 7,
        description: "Numeric level 1-7 (crisis=1, superflow=7)",
      },
      reasoning: {
        type: "string",
        description: "Brief reasoning for zone choice (1-2 sentences)",
      },
    },
    required: ["zone", "zoneLevel", "reasoning"],
  },
};

export const SUGGEST_TASK_ACTIONS_TOOL: Anthropic.Messages.Tool = {
  name: "suggest_task_actions",
  description: "Suggest action for each incomplete task at end of day",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            taskId: { type: "string" },
            action: {
              type: "string",
              enum: ["transfer", "defer", "cancel"],
            },
            reasoning: {
              type: "string",
              description: "One sentence explanation",
            },
          },
          required: ["taskId", "action", "reasoning"],
        },
      },
    },
    required: ["suggestions"],
  },
};

export const PLAN_TOMORROW_TOOL: Anthropic.Messages.Tool = {
  name: "plan_tomorrow",
  description: "Generate tomorrow's task plan and select Joy-passana task",
  input_schema: {
    type: "object" as const,
    properties: {
      plan: {
        type: "string",
        description: "Formatted plan text for Telegram (max ~3500 chars)",
      },
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["title"],
        },
      },
      joyTask: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short, actionable title for the Joy-passana task",
          },
          reasoning: {
            type: "string",
            description: "Why this task was chosen based on user's interests",
          },
        },
        required: ["title", "reasoning"],
      },
    },
    required: ["plan", "tasks", "joyTask"],
  },
};

// ============================================================
// Prompt Builders — Morning
// ============================================================

export function buildZonePrompt(
  ratings: { physical: number; emotional: number; energy: number },
  workingMemory: string,
): string {
  return `Ты — заботливый коуч, определяющий зону НейроБаланса пользователя.

Система зон НейроБаланса (7 уровней):
1. crisis / Кризис (1) — критическое состояние, все показатели 1-2/10. Нужна помощь и отдых.
2. exhaustion / Истощение (2) — сильная усталость, показатели 2-3/10. Минимальная нагрузка.
3. decline / Спад (3) — спад энергии, показатели 3-4/10. Осторожный режим, базовые привычки.
4. stable / Стабильность (4) — стабильное состояние, показатели 4-6/10. Стандартный набор задач.
5. rise / Подъём (5) — хорошее самочувствие, показатели 6-7/10. Можно включать сложные задачи.
6. flow / Поток (6) — высокая продуктивность, показатели 7-8/10. Амбициозные цели.
7. superflow / Суперпоток (7) — пиковое состояние, показатели 8-10/10. Максимум возможностей.

ВАЖНО: определение зоны контекстуальное. Учитывай не только числа, но и тренды (растёт/падает), жизненные обстоятельства из контекста, и общее впечатление. Одни и те же оценки 5-5-5 у человека в депрессии и у здорового человека — разные зоны.

Оценки пользователя (1-10):
- Физическое состояние: ${ratings.physical}
- Эмоциональное состояние: ${ratings.emotional}
- Энергия/мотивация: ${ratings.energy}
- Среднее: ${((ratings.physical + ratings.emotional + ratings.energy) / 3).toFixed(1)}

Контекст пользователя:
${workingMemory}

Используй tool determine_zone для ответа.`;
}

export function buildMorningPlanPrompt(
  zone: NeuroBalanceZone,
  zoneLevel: number,
  tasks: Array<{ title: string; priority?: number }>,
  habits: Array<{ name: string; momentum?: number }>,
  goals: Array<{ title: string; deadline?: string }>,
  workingMemory: string,
  customInstruction?: string,
): string {
  const taskLimit =
    zoneLevel <= 2 ? "1-2" : zoneLevel <= 4 ? "3-5" : "5-8";

  const toneMap: Record<string, string> = {
    "1": "Мягкий, поддерживающий. Фокус на отдых и восстановление. Минимум задач, максимум заботы о себе.",
    "2": "Осторожный, заботливый. Только самое важное. Добавь одну приятную привычку для поднятия духа.",
    "3": "Спокойный, реалистичный. Стандартные привычки, но без перегрузки.",
    "4": "Нейтральный, деловой. Стандартный набор привычек и задач.",
    "5": "Позитивный, мотивирующий. Можно включить что-то сложное и интересное.",
    "6": "Энергичный, вдохновляющий. Включи амбициозные задачи и сложные привычки.",
    "7": "Драйвовый, амбициозный. Максимум задач, stretch goals, смелые вызовы!",
  };
  const tone = toneMap[String(zoneLevel)] ?? toneMap["4"];

  const tasksText =
    tasks.length > 0
      ? tasks.map((t) => `- ${t.title}`).join("\n")
      : "Нет активных задач";
  const habitsText =
    habits.length > 0
      ? habits
          .map(
            (h) =>
              `- ${h.name}${h.momentum != null ? ` (momentum: ${h.momentum}%)` : ""}`,
          )
          .join("\n")
      : "Нет активных привычек";
  const goalsText =
    goals.length > 0
      ? goals
          .map(
            (g) =>
              `- ${g.title}${g.deadline ? ` (дедлайн: ${g.deadline})` : ""}`,
          )
          .join("\n")
      : "Нет активных целей";

  let encouragement = "";
  if (zoneLevel <= 2) {
    encouragement = "\nВ конце плана добавь короткое сообщение поддержки (1-2 предложения).";
  }

  return `Составь план дня для пользователя.

Зона: ${zone} (${zoneLevel}/7)
Тон: ${tone}
Количество задач: ${taskLimit}${encouragement}

Задачи пользователя:
${tasksText}

Привычки:
${habitsText}

Цели:
${goalsText}

Контекст:
${workingMemory}

${customInstruction ? `Пожелания пользователя: ${customInstruction}\n` : ""}Формат ответа (строго, максимум 3500 символов):
Задачи:
- Задача [~время]

Привычки:
- Привычка

Фокус: Цель (дедлайн)
━━━━━━━━━━━━━━━━
~Xч запланировано

Не добавляй заголовок зоны — он формируется ботом.`;
}

// ============================================================
// Prompt Builders — Evening Scanner
// ============================================================

/**
 * Builds prompt for AI to suggest actions for incomplete tasks.
 * Returns JSON: Array<{ taskId: string, action: "transfer"|"defer"|"cancel", reasoning: string }>
 */
export function buildTaskTransferPrompt(
  incompleteTasks: Array<{ id: string; title: string }>,
  dayContext: string,
): string {
  const tasksText = incompleteTasks
    .map((t) => `- [${t.id}] ${t.title}`)
    .join("\n");

  return `Ты помогаешь пользователю разобраться с незавершёнными задачами в конце дня.

Критерии принятия решений:
- "transfer" (перенести на завтра): задача актуальна, будет выполнима завтра
- "defer" (отложить): не срочно, нет ближайшего дедлайна, или нужно подождать чего-то
- "cancel" (отменить): задача больше не актуальна или была лишней

Учитывай контекст дня при рекомендациях: в тяжёлые дни (низкая оценка, низкая зона) склоняйся к переносу/откладыванию, а не нагружай пользователя.

Незавершённые задачи:
${tasksText}

Контекст дня:
${dayContext}

Ответь строго в JSON формате (1 предложение reasoning на задачу):
[{"taskId": "...", "action": "transfer"|"defer"|"cancel", "reasoning": "..."}]`;
}

/**
 * Builds prompt for AI to generate tomorrow's plan + Joy-passana task.
 * Returns JSON: { plan: string, tasks: Array<{title, priority}>, joyTask: {title, reasoning} }
 */
export function buildTomorrowPlanPrompt(
  transferredTasks: Array<{ id: string; title: string }>,
  activeGoals: Array<{ title: string; deadline?: string }>,
  userFacts: string,
  recentHighlights: string[],
  todayZone: string | null,
): string {
  const transferred = transferredTasks.length > 0
    ? transferredTasks.map((t) => `- ${t.title}`).join("\n")
    : "Нет перенесённых задач";
  const goals = activeGoals.length > 0
    ? activeGoals.map((g) => `- ${g.title}${g.deadline ? ` (дедлайн: ${g.deadline})` : ""}`).join("\n")
    : "Нет активных целей";
  const highlights = recentHighlights.length > 0
    ? recentHighlights.map((h) => `- ${h}`).join("\n")
    : "Нет данных";

  return `Составь план на завтра и предложи одну задачу-радость (Joy-passana).

Правила планирования:
1. Перенесённые задачи — приоритет (уже были запланированы)
2. Задачи из целей с дедлайном в ближайшие 7 дней
3. Реалистичная нагрузка (учитывай сегодняшнюю зону как прогноз на завтра)
4. Максимум 3500 символов для текста плана

Joy-passana (задача-радость):
- Выбери ОДНО приятное занятие на 15-30 минут
- Основано на интересах и хобби пользователя
- НЕ связано с продуктивностью — это про радость, творчество, удовольствие
- Примеры: почитать книгу, позвонить другу, прогуляться, порисовать
- Выбирай из фактов о пользователе, не придумывай

Перенесённые задачи (уже запланированы):
${transferred}

Активные цели (дедлайн в ближайшие 7 дней):
${goals}

Зона сегодня: ${todayZone ?? "не определена"}

Интересы и факты о пользователе:
${userFacts}

Недавние приятные моменты:
${highlights}

Ответь строго в JSON формате:
{
  "plan": "Текст плана на завтра (макс 3500 символов)...",
  "tasks": [{"title": "...", "priority": "high|medium|low"}],
  "joyTask": {"title": "...", "reasoning": "..."}
}`;
}

/**
 * Builds prompt for AI to generate an empathetic day summary.
 */
export function buildDaySummaryPrompt(
  dayData: {
    zone?: string | null;
    overall_score?: number | null;
    highlights?: unknown;
    morning_plan?: string | null;
  },
): string {
  const highlights = Array.isArray(dayData.highlights)
    ? (dayData.highlights as string[]).join("; ")
    : "нет данных";

  const score = dayData.overall_score ?? 0;
  const toneHint = score >= 7
    ? "Это был хороший день — отметь успехи, но не перегибай с восторгом."
    : score >= 4
      ? "Обычный день — отметь что получилось и мягко упомяни, что можно улучшить."
      : "Тяжёлый день — будь сострадательным, нормализуй трудности, подчеркни что пользователь справился.";

  return `Ты — заботливый друг, который подводит итоги дня вместе с пользователем.

${toneHint}

Напиши краткое резюме дня (2-4 предложения). Не будь клиническим или аналитическим.
Признай что получилось и мягко отметь вызовы без осуждения.

Данные дня:
- Зона: ${dayData.zone ?? "не определена"}
- Оценка: ${dayData.overall_score ?? "не указана"}/10
- Замечательные моменты: ${highlights}
- Утренний план: ${dayData.morning_plan ? "был составлен" : "не составлен"}`;
}
