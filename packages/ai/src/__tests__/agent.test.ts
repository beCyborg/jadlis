import { describe, test, expect, mock, beforeEach, spyOn } from "bun:test";

// ============================================================
// Mock Agent SDK only (NOT memory — use DI instead)
// ============================================================

let mockQueryMessages: any[] = [];
let mockQueryCalls: any[] = [];

mock.module("@anthropic-ai/claude-agent-sdk", () => ({
  query: (params: any) => {
    mockQueryCalls.push(params);
    return (async function* () {
      for (const msg of mockQueryMessages) {
        yield msg;
      }
    })();
  },
}));

// ============================================================
// Mock deps via dependency injection (no mock.module for memory)
// ============================================================

let mockWorkingMemory = "test working memory context";

const mockDeps = {
  buildWorkingMemory: async () => mockWorkingMemory,
  invalidateWorkingMemoryCache: async () => {},
};

// ============================================================
// Tests
// ============================================================

beforeEach(() => {
  mockQueryMessages = [
    {
      type: "result",
      subtype: "success",
      result: "Agent response text",
      is_error: false,
      num_turns: 3,
      duration_ms: 5000,
      total_cost_usd: 0.05,
      usage: { input_tokens: 1000, output_tokens: 500 },
    },
  ];
  mockQueryCalls = [];
  mockWorkingMemory = "test working memory context";
});

describe("runAgent()", () => {
  test("calls agent SDK query() with correct model", async () => {
    const { runAgent } = await import("../agent");
    await runAgent("test prompt", {
      chatId: 123,
      userId: "user-1",
      sessionKey: "123",
    }, mockDeps as any);

    expect(mockQueryCalls.length).toBe(1);
    expect(mockQueryCalls[0].options.model).toBe("claude-sonnet-4-6");
  });

  test("returns the final message text as a string", async () => {
    const { runAgent } = await import("../agent");
    const result = await runAgent("test prompt", {
      chatId: 123,
      userId: "user-1",
      sessionKey: "123",
    }, mockDeps as any);

    expect(result).toBe("Agent response text");
  });

  test("includes MCP server configs in query() call", async () => {
    const { runAgent } = await import("../agent");
    await runAgent("test prompt", {
      chatId: 123,
      userId: "user-1",
      sessionKey: "123",
    }, mockDeps as any);

    const mcpServers = mockQueryCalls[0].options.mcpServers;
    expect(mcpServers).toBeDefined();
    expect(Object.keys(mcpServers).length).toBeGreaterThanOrEqual(3);
    expect(mcpServers["jadlis-supabase"]).toBeDefined();
    expect(mcpServers["jadlis-polymarket"]).toBeDefined();
    expect(mcpServers["jadlis-firecrawl"]).toBeDefined();
  });

  test("returns empty string on error result", async () => {
    mockQueryMessages = [
      {
        type: "result",
        subtype: "error",
        is_error: true,
        error: "SDK error",
        result: "",
      },
    ];

    const { runAgent } = await import("../agent");
    const result = await runAgent("test prompt", {
      chatId: 123,
      userId: "user-1",
      sessionKey: "123",
    }, mockDeps as any);

    expect(result).toBe("");
  });

  test("passes system prompt containing working memory context", async () => {
    mockWorkingMemory = "user prefers morning rituals";
    const { runAgent } = await import("../agent");
    await runAgent("test prompt", {
      chatId: 123,
      userId: "user-1",
      sessionKey: "123",
    }, mockDeps as any);

    const systemPrompt = mockQueryCalls[0].options.systemPrompt;
    expect(systemPrompt).toContain("user prefers morning rituals");
  });

  test("disables session persistence", async () => {
    const { runAgent } = await import("../agent");
    await runAgent("test prompt", {
      chatId: 123,
      userId: "user-1",
      sessionKey: "123",
    }, mockDeps as any);

    expect(mockQueryCalls[0].options.persistSession).toBe(false);
  });

  test("uses bypassPermissions mode", async () => {
    const { runAgent } = await import("../agent");
    await runAgent("test prompt", {
      chatId: 123,
      userId: "user-1",
      sessionKey: "123",
    }, mockDeps as any);

    expect(mockQueryCalls[0].options.permissionMode).toBe("bypassPermissions");
  });
});

describe("PreToolUse hook", () => {
  test("blocks tool call when rate limit exceeded", async () => {
    const { createPreToolUseHook, MAX_TOOL_CALLS_PER_SESSION } = await import("../agent");
    const hook = createPreToolUseHook();

    for (let i = 0; i < MAX_TOOL_CALLS_PER_SESSION; i++) {
      await hook(
        { hook_event_name: "PreToolUse", tool_name: "read_needs", tool_input: {}, tool_use_id: `t${i}` } as any,
        `t${i}`,
        { signal: new AbortController().signal },
      );
    }

    const result = await hook(
      { hook_event_name: "PreToolUse", tool_name: "read_needs", tool_input: {}, tool_use_id: "tX" } as any,
      "tX",
      { signal: new AbortController().signal },
    );

    expect(result.permissionDecision).toBe("deny");
  });

  test("allows tool call when under rate limit", async () => {
    const { createPreToolUseHook } = await import("../agent");
    const hook = createPreToolUseHook();

    const result = await hook(
      { hook_event_name: "PreToolUse", tool_name: "read_needs", tool_input: {}, tool_use_id: "t1" } as any,
      "t1",
      { signal: new AbortController().signal },
    );

    expect(result.permissionDecision).toBe("allow");
  });

  test("increments call counter per invocation", async () => {
    const { createPreToolUseHook } = await import("../agent");
    const hook = createPreToolUseHook();

    for (let i = 0; i < 3; i++) {
      await hook(
        { hook_event_name: "PreToolUse", tool_name: `tool${i}`, tool_input: {}, tool_use_id: `t${i}` } as any,
        `t${i}`,
        { signal: new AbortController().signal },
      );
    }

    const result = await hook(
      { hook_event_name: "PreToolUse", tool_name: "d", tool_input: {}, tool_use_id: "t4" } as any,
      "t4",
      { signal: new AbortController().signal },
    );
    expect(result.permissionDecision).toBe("allow");
  });
});

describe("PreToolUse hook — user_id validation", () => {
  test("denies supabase tool call without user_id", async () => {
    const { createPreToolUseHook } = await import("../agent");
    const hook = createPreToolUseHook();

    const result = await hook(
      { hook_event_name: "PreToolUse", tool_name: "jadlis-supabase__read_needs", tool_input: {}, tool_use_id: "t1" } as any,
      "t1",
      { signal: new AbortController().signal },
    );

    expect(result.permissionDecision).toBe("deny");
  });

  test("allows supabase tool call with user_id", async () => {
    const { createPreToolUseHook } = await import("../agent");
    const hook = createPreToolUseHook();

    const result = await hook(
      { hook_event_name: "PreToolUse", tool_name: "jadlis-supabase__read_needs", tool_input: { user_id: "u1" }, tool_use_id: "t1" } as any,
      "t1",
      { signal: new AbortController().signal },
    );

    expect(result.permissionDecision).toBe("allow");
  });

  test("allows non-supabase tool call without user_id", async () => {
    const { createPreToolUseHook } = await import("../agent");
    const hook = createPreToolUseHook();

    const result = await hook(
      { hook_event_name: "PreToolUse", tool_name: "jadlis-firecrawl__scrape", tool_input: {}, tool_use_id: "t1" } as any,
      "t1",
      { signal: new AbortController().signal },
    );

    expect(result.permissionDecision).toBe("allow");
  });
});

describe("PostToolUse hook", () => {
  test("logs tool name and returns continue", async () => {
    const { createPostToolUseHook } = await import("../agent");
    const hook = createPostToolUseHook();

    const result = await hook(
      {
        hook_event_name: "PostToolUse",
        tool_name: "read_habits",
        tool_input: {},
        tool_use_id: "t1",
        tool_result: "ok",
      } as any,
      "t1",
      { signal: new AbortController().signal },
    );

    expect(result).toHaveProperty("hookEventName", "PostToolUse");
  });

  test("warns on cache miss (Issue #192)", async () => {
    const { createPostToolUseHook } = await import("../agent");
    const hook = createPostToolUseHook();
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    await hook(
      {
        hook_event_name: "PostToolUse",
        tool_name: "read_habits",
        tool_input: {},
        tool_use_id: "t1",
        tool_result: "ok",
        usage: { cache_creation_input_tokens: 1500 },
      } as any,
      "t1",
      { signal: new AbortController().signal },
    );

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("Subagent stubs", () => {
  test("getSubagentConfig('ritual-morning-agent') returns object with name", async () => {
    const { getSubagentConfig } = await import("../agent");
    const config = getSubagentConfig("ritual-morning-agent");

    expect(config).not.toBeNull();
    expect(config!.name).toBe("ritual-morning-agent");
  });

  test("getSubagentConfig for unknown agent returns null", async () => {
    const { getSubagentConfig } = await import("../agent");
    expect(getSubagentConfig("unknown-agent")).toBeNull();
  });

  test("all planned subagents are registered", async () => {
    const { getSubagentConfig } = await import("../agent");

    expect(getSubagentConfig("ritual-morning-agent")).not.toBeNull();
    expect(getSubagentConfig("ritual-evening-agent")).not.toBeNull();
    expect(getSubagentConfig("ritual-weekly-agent")).not.toBeNull();
    expect(getSubagentConfig("news-digest-agent")).not.toBeNull();
    expect(getSubagentConfig("research-integration-agent")).not.toBeNull();
  });
});
