import { describe, test, expect, beforeEach, mock } from "bun:test";

// ============================================================
// Mock Anthropic SDK
// ============================================================
let mockCreateResponse: any = {};
let mockCreateShouldThrow: Error | null = null;
let mockCreateCallCount = 0;
let mockCreateArgs: any[] = [];

mock.module("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: async (params: any) => {
          mockCreateCallCount++;
          mockCreateArgs.push(params);
          if (mockCreateShouldThrow) {
            throw mockCreateShouldThrow;
          }
          return mockCreateResponse;
        },
      };
    },
  };
});

// ============================================================
// Tests
// ============================================================

describe("Claude wrapper", () => {
  beforeEach(() => {
    mockCreateArgs = [];
    mockCreateResponse = {
      content: [{ type: "text", text: "Ответ от Claude" }],
      usage: { input_tokens: 100, output_tokens: 50 },
    };
    mockCreateShouldThrow = null;
    mockCreateCallCount = 0;
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.CLAUDE_MODEL = "claude-sonnet-4-6";
  });

  test("sends request with correct model from CLAUDE_MODEL env var", async () => {
    const { createMessage } = await import("./claude");
    await createMessage("Привет");

    expect(mockCreateArgs.length).toBeGreaterThan(0);
    expect(mockCreateArgs[0].model).toBe("claude-sonnet-4-6");
  });

  test("includes cache_control on system prompt first content block", async () => {
    const { createMessage } = await import("./claude");
    await createMessage("Привет");

    const systemBlocks = mockCreateArgs[0].system;
    expect(Array.isArray(systemBlocks)).toBe(true);
    expect(systemBlocks[0].cache_control).toEqual({ type: "ephemeral" });
  });

  test("system prompt first block is >2048 tokens (cache-friendly)", async () => {
    const { STABLE_SYSTEM_PROMPT } = await import("./claude");

    // Russian text: ~2.5 chars per token (Cyrillic = 2 bytes, BPE splits)
    const estimatedTokens = STABLE_SYSTEM_PROMPT.length / 2.5;
    expect(estimatedTokens).toBeGreaterThan(2048);
  });
});

describe("Intent classification", () => {
  beforeEach(() => {
    mockCreateArgs = [];
    mockCreateShouldThrow = null;
    mockCreateCallCount = 0;
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.CLAUDE_MODEL = "claude-sonnet-4-6";
  });

  test("returns structured response via tool_use", async () => {
    mockCreateResponse = {
      content: [
        {
          type: "tool_use",
          id: "toolu_123",
          name: "classify_intent",
          input: { intent: "question", urgency: 2, needs_agent: false },
        },
      ],
      stop_reason: "tool_use",
    };

    const { classifyIntent } = await import("./claude");
    const result = await classifyIntent("Какие у меня привычки?");

    expect(result.intent).toBe("question");
    expect(result.urgency).toBe(2);
    expect(result.needs_agent).toBe(false);
  });

  test("classifies simple query as needs_agent=false", async () => {
    mockCreateResponse = {
      content: [
        {
          type: "tool_use",
          id: "toolu_124",
          name: "classify_intent",
          input: { intent: "question", urgency: 1, needs_agent: false },
        },
      ],
      stop_reason: "tool_use",
    };

    const { classifyIntent } = await import("./claude");
    const result = await classifyIntent("Какие у меня привычки?");
    expect(result.needs_agent).toBe(false);
  });

  test("classifies complex query as needs_agent=true", async () => {
    mockCreateResponse = {
      content: [
        {
          type: "tool_use",
          id: "toolu_125",
          name: "classify_intent",
          input: { intent: "daily_review", urgency: 4, needs_agent: true },
        },
      ],
      stop_reason: "tool_use",
    };

    const { classifyIntent } = await import("./claude");
    const result = await classifyIntent("Проанализируй мой прогресс за неделю");
    expect(result.needs_agent).toBe(true);
  });

  test("intent classification uses max_tokens: 200", async () => {
    mockCreateResponse = {
      content: [
        {
          type: "tool_use",
          id: "toolu_126",
          name: "classify_intent",
          input: { intent: "question", urgency: 1, needs_agent: false },
        },
      ],
      stop_reason: "tool_use",
    };

    const { classifyIntent } = await import("./claude");
    await classifyIntent("Тест");

    const classifyCall = mockCreateArgs.find((a: any) => a.max_tokens === 200);
    expect(classifyCall).toBeDefined();
  });
});

describe("Graceful degradation", () => {
  beforeEach(() => {
    mockCreateArgs = [];
    mockCreateShouldThrow = null;
    mockCreateCallCount = 0;
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.CLAUDE_MODEL = "claude-sonnet-4-6";
  });

  test("returns fallback string when Claude API is unavailable", async () => {
    const error: any = new Error("Rate limited");
    error.status = 429;
    mockCreateShouldThrow = error;

    const { createMessage } = await import("./claude");
    const result = await createMessage("Привет");

    expect(result).toContain("недоступен");
    expect(mockCreateCallCount).toBe(1);
  });

  test("does NOT retry on 429 (respects rate limit)", async () => {
    const error: any = new Error("Rate limited");
    error.status = 429;
    mockCreateShouldThrow = error;

    const { createMessage } = await import("./claude");
    const result = await createMessage("Привет");

    expect(mockCreateCallCount).toBe(1);
    expect(result).toContain("недоступен");
  });

  test("retries on 5xx errors before giving up", async () => {
    // Simulate: fail with 500 on all attempts
    // Use short maxRetries — but we can't control that from test
    // Instead, just verify that multiple calls are made
    let callsBeforeFallback = 0;

    const error500: any = new Error("Server Error");
    error500.status = 500;
    mockCreateShouldThrow = error500;

    const { createMessage } = await import("./claude");

    // This will retry 3 times with backoff. Set a longer timeout.
    const result = await createMessage("Тест retry");

    // Should have tried 4 times (1 initial + 3 retries)
    expect(mockCreateCallCount).toBe(4);
    expect(result).toContain("недоступен");
  }, 15000); // 15s timeout for retry delays
});
