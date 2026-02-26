import { describe, test, expect } from "bun:test";
import {
  buildZonePrompt,
  buildMorningPlanPrompt,
  buildTaskTransferPrompt,
  buildTomorrowPlanPrompt,
  buildDaySummaryPrompt,
  DETERMINE_ZONE_TOOL,
  SUGGEST_TASK_ACTIONS_TOOL,
  PLAN_TOMORROW_TOOL,
  ZONE_DISPLAY,
  ZONE_PROMPT_CACHEABLE,
  MORNING_PLAN_PROMPT_CACHEABLE,
  TASK_TRANSFER_PROMPT_CACHEABLE,
  DAY_SUMMARY_PROMPT_CACHEABLE,
} from "../dailyCycle";

// --- buildZonePrompt ---

describe("buildZonePrompt", () => {
  test("includes all 7 zone descriptions", () => {
    const result = buildZonePrompt({ physical: 7, emotional: 6, energy: 8 }, "memory");
    expect(result).toContain("crisis");
    expect(result).toContain("exhaustion");
    expect(result).toContain("decline");
    expect(result).toContain("stable");
    expect(result).toContain("rise");
    expect(result).toContain("flow");
    expect(result).toContain("superflow");
  });

  test("includes ratings and working memory", () => {
    const result = buildZonePrompt({ physical: 5, emotional: 3, energy: 7 }, "user loves coding");
    expect(result).toContain("5");
    expect(result).toContain("3");
    expect(result).toContain("7");
    expect(result).toContain("user loves coding");
  });

  test("calculates average", () => {
    const result = buildZonePrompt({ physical: 6, emotional: 6, energy: 9 }, "");
    expect(result).toContain("7.0");
  });
});

describe("DETERMINE_ZONE_TOOL", () => {
  test("schema has required fields: zone, zoneLevel, reasoning", () => {
    const props = DETERMINE_ZONE_TOOL.input_schema.properties as Record<string, unknown>;
    expect(props).toHaveProperty("zone");
    expect(props).toHaveProperty("zoneLevel");
    expect(props).toHaveProperty("reasoning");
  });

  test("zone enum contains all 7 zones", () => {
    const zoneSchema = (DETERMINE_ZONE_TOOL.input_schema.properties as Record<string, { enum?: string[] }>).zone;
    expect(zoneSchema.enum).toEqual([
      "crisis", "exhaustion", "decline", "stable", "rise", "flow", "superflow",
    ]);
  });
});

// --- buildMorningPlanPrompt ---

describe("buildMorningPlanPrompt", () => {
  test("includes zone-specific planning rules for low zones", () => {
    const result = buildMorningPlanPrompt("crisis", 1, [], [], [], "");
    expect(result).toContain("1-2");
    expect(result).toContain("отдых");
  });

  test("includes zone-specific planning rules for high zones", () => {
    const result = buildMorningPlanPrompt("superflow", 7, [], [], [], "");
    expect(result).toContain("5-8");
    expect(result).toContain("амбициозн");
  });

  test("constrains output to ~3500 chars", () => {
    const result = buildMorningPlanPrompt("stable", 4, [], [], [], "");
    expect(result).toContain("3500");
  });

  test("includes tasks, habits, goals", () => {
    const result = buildMorningPlanPrompt(
      "stable", 4,
      [{ title: "Написать отчёт" }],
      [{ name: "Медитация", momentum: 80 }],
      [{ title: "Выучить Go", deadline: "2026-03-01" }],
      "context",
    );
    expect(result).toContain("Написать отчёт");
    expect(result).toContain("Медитация");
    expect(result).toContain("momentum: 80%");
    expect(result).toContain("Выучить Go");
  });

  test("includes encouragement for low zones (1-2)", () => {
    const result = buildMorningPlanPrompt("exhaustion", 2, [], [], [], "");
    expect(result).toContain("поддержки");
  });

  test("includes custom instruction when provided", () => {
    const result = buildMorningPlanPrompt("stable", 4, [], [], [], "", "Добавь медитацию");
    expect(result).toContain("Добавь медитацию");
  });
});

// --- buildTaskTransferPrompt ---

describe("buildTaskTransferPrompt", () => {
  test("includes task IDs and titles", () => {
    const result = buildTaskTransferPrompt(
      [{ id: "t1", title: "Задача 1" }, { id: "t2", title: "Задача 2" }],
      "Оценка: 7/10",
    );
    expect(result).toContain("t1");
    expect(result).toContain("Задача 1");
    expect(result).toContain("t2");
    expect(result).toContain("Задача 2");
  });

  test("includes day context", () => {
    const result = buildTaskTransferPrompt(
      [{ id: "t1", title: "Задача" }],
      "Зона: stable, оценка: 6/10",
    );
    expect(result).toContain("Зона: stable");
  });

  test("explains all three actions", () => {
    const result = buildTaskTransferPrompt([{ id: "t1", title: "x" }], "");
    expect(result).toContain("transfer");
    expect(result).toContain("defer");
    expect(result).toContain("cancel");
  });
});

describe("SUGGEST_TASK_ACTIONS_TOOL", () => {
  test("schema has suggestions array with action enum", () => {
    const props = SUGGEST_TASK_ACTIONS_TOOL.input_schema.properties as Record<string, { type: string; items?: { properties: Record<string, { enum?: string[] }> } }>;
    expect(props).toHaveProperty("suggestions");
    expect(props.suggestions.type).toBe("array");
    const actionSchema = props.suggestions.items?.properties?.action;
    expect(actionSchema?.enum).toEqual(["transfer", "defer", "cancel"]);
  });
});

// --- buildTomorrowPlanPrompt ---

describe("buildTomorrowPlanPrompt", () => {
  test("combines plan + Joy-passana in single prompt", () => {
    const result = buildTomorrowPlanPrompt([], [], "", [], null);
    expect(result).toContain("Joy-passana");
    expect(result).toContain("план");
  });

  test("includes transferred tasks and goals", () => {
    const result = buildTomorrowPlanPrompt(
      [{ id: "t1", title: "Перенесённая задача" }],
      [{ title: "Цель 1", deadline: "2026-03-01" }],
      "facts",
      ["Красивый закат"],
      "stable",
    );
    expect(result).toContain("Перенесённая задача");
    expect(result).toContain("Цель 1");
    expect(result).toContain("Красивый закат");
    expect(result).toContain("stable");
  });

  test("constrains output to ~3500 chars", () => {
    const result = buildTomorrowPlanPrompt([], [], "", [], null);
    expect(result).toContain("3500");
  });
});

describe("PLAN_TOMORROW_TOOL", () => {
  test("schema has plan, tasks, and joyTask", () => {
    const props = PLAN_TOMORROW_TOOL.input_schema.properties as Record<string, unknown>;
    expect(props).toHaveProperty("plan");
    expect(props).toHaveProperty("tasks");
    expect(props).toHaveProperty("joyTask");
  });
});

// --- buildDaySummaryPrompt ---

describe("buildDaySummaryPrompt", () => {
  test("includes day data fields", () => {
    const result = buildDaySummaryPrompt({
      zone: "flow",
      overall_score: 8,
      highlights: ["Отличная встреча"],
      morning_plan: "План дня",
    });
    expect(result).toContain("flow");
    expect(result).toContain("8");
    expect(result).toContain("Отличная встреча");
  });

  test("instructs empathetic tone for good days", () => {
    const result = buildDaySummaryPrompt({ overall_score: 8 });
    expect(result).toContain("хороший день");
  });

  test("instructs compassionate tone for hard days", () => {
    const result = buildDaySummaryPrompt({ overall_score: 2 });
    expect(result).toContain("Тяжёлый день");
  });

  test("handles missing data gracefully", () => {
    const result = buildDaySummaryPrompt({});
    expect(result).toContain("не определена");
    expect(result).toContain("не указана");
  });
});

// --- ZONE_DISPLAY ---

describe("ZONE_DISPLAY", () => {
  test("contains all 7 zones with Russian names", () => {
    expect(ZONE_DISPLAY.crisis.ru).toBe("Кризис");
    expect(ZONE_DISPLAY.superflow.ru).toBe("Суперпоток");
    expect(ZONE_DISPLAY.stable.level).toBe(4);
  });
});

// --- Cacheability ---

describe("Prompt cacheability annotations", () => {
  test("large prompts marked as cacheable", () => {
    expect(ZONE_PROMPT_CACHEABLE).toBe(true);
    expect(MORNING_PLAN_PROMPT_CACHEABLE).toBe(true);
  });

  test("small prompts marked as not cacheable", () => {
    expect(TASK_TRANSFER_PROMPT_CACHEABLE).toBe(false);
    expect(DAY_SUMMARY_PROMPT_CACHEABLE).toBe(false);
  });
});
