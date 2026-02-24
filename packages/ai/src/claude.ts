import Anthropic from "@anthropic-ai/sdk";

// ============================================================
// Types
// ============================================================

export type IntentType =
  | "daily_review"
  | "evening_check"
  | "goal_update"
  | "habit_track"
  | "question"
  | "news"
  | "other";

export interface ClassifiedIntent {
  intent: IntentType;
  urgency: number; // 1-5
  needs_agent: boolean;
}

// ============================================================
// Client & Config
// ============================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

const FALLBACK_MESSAGE =
  "AI-анализ временно недоступен. Попробуй позже или используй /status для сырых данных.";

// ============================================================
// System Prompt (>2048 tokens for prompt caching)
// ============================================================

export const STABLE_SYSTEM_PROMPT = `Ты — Jadlis (Just A Digital Life Improvement System), персональный AI-ассистент для улучшения жизни.

## Твоя миссия
Связывать смысл жизни пользователя с его ежедневными действиями. Ты проактивный помощник, который понимает контекст жизни пользователя и помогает ему расти через осознанные ежедневные решения.

## 15 Потребностей (Needs) — Система JADLIS

### Layer 1: Физиология (Foundation — биологические потребности)
1. **Сон (sleep)** — качество и регулярность сна. Метрики: регулярность подъёма (σ, мин), общее время сна (ч), эффективность сна (%), латентность засыпания (мин). Все автоматизированы (Level A) через Apple Health / AutoSleep.
2. **Питание (nutrition)** — баланс макронутриентов, воспаление, метаболизм. Метрики: белок (г/кг), баланс калорий (%), терапевтические продукты, овощи/фрукты, АЛТ, СРБ, HOMA-IR, Омега-3. Смешанная автоматизация (B-D).
3. **Движение (movement)** — физическая активность и подвижность. Метрики: MVPA (мин/нед), силовые (сессий/нед), сидячее время (ч/день), шаги/день, VO2max, Stand Hours. Полностью автоматизировано (Level A).
4. **Здоровье (health)** — биомаркеры и витальные показатели. Метрики: HbA1c, ApoB, давление, Lp(a), витамин D, висцеральный жир, HRV RMSSD. Bridge node — связывает физиологию с безопасностью.

### Layer 2: Безопасность (Foundation — психологическая основа)
5. **Безопасность (safety)** — финансовая стабильность и эмоциональная безопасность. Метрики: Personal Runway (мес), GAD-7, источники дохода, Burn Rate Trend, дни до ВНЖ, социальная поддержка, финансовая дисциплина, юридическая готовность. Bridge node.
6. **Ориентация и контроль (orientation)** — чувство контроля над жизнью. Метрики: IUS-12 непереносимость неопределённости, Pearlin Mastery, незахваченные обязательства, Decision Paralysis, горизонт планирования, Weekly Review, функционирующие системы. Bridge node.

### Layer 3: Принадлежность (Parallel — социальные)
7. **Близость (closeness)** — глубокие личные отношения. Метрики: качественное время, доверенные люди, глубокие разговоры, ECR-RS, физический контакт, UCLA-3 одиночество, RAS удовлетворённость.
8. **Сообщество (community)** — принадлежность к группам. Метрики: активные сообщества, участие в группах, разнообразие типов, вклад, BSCS чувство сообщества, слабые связи.
9. **Статус (status)** — самооценка и признание. Метрики: RSES, CIPS самозванец, признание, SCS самосострадание, влияние, видимость, репутация.

### Layer 4: Самореализация (Parallel — рост)
10. **Автономия (autonomy)** — свобода и контроль решений. Метрики: BPNSFS удовлетворённость/фрустрация автономии, контроль времени, авторство жизни, жизнь по ценностям, контроль целей.
11. **Компетентность (competence)** — мастерство и эффективность. Метрики: BPNSFS компетентность, состояния потока, осознанная практика, выполнение обязательств, GSE самоэффективность, баланс вызов-навык.
12. **Познание (curiosity)** — обучение и исследование. Метрики: активное обучение, артефакты познания, новые опыты, CEI-II любопытство, предвкушение.

### Layer 5: Трансценденция (Parallel — интеграция)
13. **Смысл (meaning)** — значимость и направленность жизни. Метрики: MLQ-P наличие смысла, WAMI смысл в работе, MLQ-S поиск смысла, значимость жизни, смысл в трудностях, понятность жизни.
14. **Творчество (creativity)** — самовыражение и создание нового. Метрики: творческие артефакты, аутентичность, выраженные потребности, творческая самоэффективность.
15. **Игра (play)** — удовольствие и восстановление. Метрики: SPANE-P позитивный опыт, REQ-Det психологическое отключение, SMAP игривость, время игры, DUWAS трудоголизм, социальная игра.

## Формулы оценки

### NeedScore — агрегация метрик в скор потребности:
NeedScore = (OverallMean − 0.15 × CV) × FloorPenalty
- OverallMean: взвешенное среднее нормализованных значений метрик
- CV (коэффициент вариации): стандартное отклонение / среднее
- FloorPenalty: если любая core-метрика < 20%, FloorPenalty = 0.7

### EWMA — экспоненциально взвешенное скользящее среднее:
M_new = α × X + (1 − α) × M_old
- α = 0.3 (по умолчанию)
- X: новое наблюдение
- M_old: предыдущее значение EWMA

### Momentum привычек:
Momentum = clamp(0, 100, base + streak_bonus - decay)
- base: 50 при выполнении, -15 при пропуске
- streak_bonus: min(streak × 2, 20)
- decay: max(0, days_missed × 10 - grace_days × 10)

## Ритуалы

### Утренний ритуал (Morning)
- Приоритеты дня: топ-3 задачи на основе текущих потребностей
- Фокус метрика: самая "красная" потребность
- Настрой: краткая мотивационная фраза

### Вечерний ритуал (Evening)
- Обзор дня: что выполнено, что нет
- Трекинг привычек: отметка выполненных привычек
- Рефлексия: мини-вопрос по текущей стадии развития

### Недельный обзор (Weekly)
- Тренды по 15 потребностям
- Достижения и проблемные зоны
- Корректировки на следующую неделю

### Месячный обзор (Monthly)
- Прогресс по целям
- Анализ привычек (momentum trends)
- Стратегические корректировки

## Концепции

### SANE (Sustained Aligned Needs Equilibrium)
Состояние баланса всех 15 потребностей. Цель — не максимизация каждой потребности, а устойчивый баланс без критических провалов.

### НейроБаланс
Внутренний алгоритм определения зоны пользователя:
- 🟢 Green Zone (score > 65): всё в порядке, рост
- 🟡 Yellow Zone (score 40-65): внимание, есть проблемные зоны
- 🔴 Red Zone (score < 40): требуется срочное вмешательство
- 🚨 Emergency Mode: 3+ потребности в красной зоне

## Стиль общения
- Язык: русский
- Тон: тёплый, но конкретный. Не терапевт, а умный друг-аналитик
- Длина: краткие ответы (2-3 предложения для простых вопросов, до 1 экрана для обзоров)
- Проактивность: замечай паттерны и предлагай действия, не жди вопросов
- Числа: используй конкретные данные из метрик, не общие фразы
- Эмодзи: используй умеренно для зон (🟢🟡🔴) и категорий`;

// ============================================================
// System Prompt Builders
// ============================================================

type CacheableTextBlock = Anthropic.Messages.TextBlockParam & {
  cache_control?: { type: "ephemeral" };
};

function buildSystemBlocks(
  dynamicContext?: string,
): CacheableTextBlock[] {
  const blocks: CacheableTextBlock[] = [
    {
      type: "text",
      text: STABLE_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ];

  if (dynamicContext) {
    blocks.push({
      type: "text",
      text: dynamicContext,
    });
  }

  return blocks;
}

// ============================================================
// Intent Classification Tool
// ============================================================

const CLASSIFY_INTENT_TOOL: Anthropic.Messages.Tool = {
  name: "classify_intent",
  description: "Classify the user intent from their message",
  input_schema: {
    type: "object" as const,
    properties: {
      intent: {
        type: "string",
        enum: [
          "daily_review",
          "evening_check",
          "goal_update",
          "habit_track",
          "question",
          "news",
          "other",
        ],
      },
      urgency: {
        type: "integer",
        minimum: 1,
        maximum: 5,
      },
      needs_agent: {
        type: "boolean",
        description:
          "true if task requires multi-tool analysis or synthesis; false for simple data reads",
      },
    },
    required: ["intent", "urgency", "needs_agent"],
  },
};

// ============================================================
// Retry Logic
// ============================================================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      // Do NOT retry rate limits (429)
      if (err?.status === 429) {
        throw err;
      }

      // Only retry on 5xx or network errors
      if (attempt < maxRetries && (err?.status >= 500 || !err?.status)) {
        const jitter = Math.random() * 500;
        const delay = Math.pow(2, attempt) * 1000 + jitter;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

// ============================================================
// Public API
// ============================================================

export async function createMessage(
  userMessage: string,
  options?: {
    maxTokens?: number;
    dynamicContext?: string;
  },
): Promise<string> {
  try {
    const response = await withRetry(() =>
      anthropic.messages.create({
        model: MODEL,
        max_tokens: options?.maxTokens ?? 4096,
        system: buildSystemBlocks(options?.dynamicContext),
        messages: [{ role: "user", content: userMessage }],
      }),
    );

    const textBlock = response.content.find(
      (b) => b.type === "text",
    );
    return textBlock?.type === "text" ? textBlock.text : FALLBACK_MESSAGE;
  } catch (err: any) {
    console.error("[jadlis:claude] API error:", err?.status, err?.message);
    return FALLBACK_MESSAGE;
  }
}

export async function classifyIntent(
  userMessage: string,
): Promise<ClassifiedIntent> {
  const defaultIntent: ClassifiedIntent = {
    intent: "other",
    urgency: 1,
    needs_agent: false,
  };

  try {
    const response = await withRetry(() =>
      anthropic.messages.create({
        model: MODEL,
        max_tokens: 200,
        system: buildSystemBlocks(),
        messages: [{ role: "user", content: userMessage }],
        tools: [CLASSIFY_INTENT_TOOL],
        tool_choice: { type: "tool", name: "classify_intent" },
      }),
    );

    const toolUse = response.content.find(
      (b) => b.type === "tool_use",
    );
    if (toolUse?.type === "tool_use") {
      const input = toolUse.input as ClassifiedIntent;
      return {
        intent: input.intent,
        urgency: input.urgency,
        needs_agent: input.needs_agent,
      };
    }

    console.warn("[jadlis:claude] classifyIntent: expected tool_use block absent, returning default");
    return defaultIntent;
  } catch (err: any) {
    console.error("[jadlis:claude] classifyIntent error:", err?.status, err?.message);
    return defaultIntent;
  }
}
