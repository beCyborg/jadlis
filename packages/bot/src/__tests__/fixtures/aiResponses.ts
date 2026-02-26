/**
 * Pre-built mock AI responses for testing conversation flows.
 * Each response satisfies the corresponding tool schema.
 */

export const mockZoneResponse = {
  zone: "rise",
  zoneLevel: 5,
  reasoning: "Физическое состояние 7/10, эмоциональное 8/10, энергия 6/10 — общий тренд на подъём.",
};

export const mockMorningPlanResponse = `**План на сегодня (зона: подъём)**

📋 Задачи:
1. Подготовить презентацию (приоритет: высокий)
2. Написать тесты для API (приоритет: средний)
3. Прочитать главу книги (приоритет: низкий)
4. 30 минут бега
5. Практика японского — 20 минут

🎯 Фокус дня: Завершить презентацию до обеда
💡 Совет: В зоне подъёма можно браться за сложные задачи`;

export const mockTaskTransferResponse = {
  actions: [
    { taskId: "task-1", action: "transfer", reason: "Не завершено, перенос на завтра" },
    { taskId: "task-2", action: "defer", reason: "Не срочно, отложить" },
    { taskId: "task-3", action: "cancel", reason: "Больше не актуально" },
  ],
};

export const mockTomorrowPlanResponse = {
  plan: `**План на завтра**

📋 Задачи:
1. Завершить презентацию (перенос с сегодня)
2. Пробежка 5 км
3. Обзорный звонок с командой

🎯 Фокус: Закрыть все переносы`,
  joyTask: {
    title: "Прогулка по парку с фотоаппаратом",
    reasoning: "Пользователь интересуется фотографией и давно не гулял",
  },
};

export const mockDaySummaryResponse =
  "Сегодня был продуктивный день в зоне подъёма. Основные достижения: завершена презентация, пройдена медитация. Задачи по API перенесены на завтра. Энергия стабильная, настроение позитивное.";

/**
 * Creates a mock Anthropic Messages response wrapping a tool_use block.
 */
export function wrapToolUse(toolName: string, input: unknown) {
  return {
    id: "msg_mock_001",
    type: "message" as const,
    role: "assistant" as const,
    content: [
      {
        type: "tool_use" as const,
        id: "toolu_mock_001",
        name: toolName,
        input,
      },
    ],
    model: "claude-sonnet-4-6",
    stop_reason: "tool_use" as const,
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

/**
 * Creates a mock Anthropic Messages response with text content.
 */
export function wrapText(text: string) {
  return {
    id: "msg_mock_002",
    type: "message" as const,
    role: "assistant" as const,
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
    model: "claude-sonnet-4-6",
    stop_reason: "end_turn" as const,
    usage: { input_tokens: 100, output_tokens: 200 },
  };
}
