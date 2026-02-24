import { query, type Options, type SDKMessage, type HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { buildWorkingMemory, invalidateWorkingMemoryCache } from "./memory";

// ============================================================
// Constants
// ============================================================

export const MAX_TOOL_CALLS_PER_SESSION = 50;

const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

// ============================================================
// Types
// ============================================================

export interface AgentRunOptions {
  chatId: number;
  userId: string;
  sessionKey: string;
}

export interface SubagentConfig {
  name: string;
  description: string;
}

// ============================================================
// MCP Server Configuration
// ============================================================

function getMcpServers(): Record<string, { command: string; args: string[] }> {
  return {
    "jadlis-supabase": {
      command: "bun",
      args: ["run", "packages/mcp-servers/src/supabase/index.ts"],
    },
    "jadlis-polymarket": {
      command: "bun",
      args: ["run", "packages/mcp-servers/src/polymarket/index.ts"],
    },
    "jadlis-firecrawl": {
      command: "bun",
      args: ["run", "packages/mcp-servers/src/firecrawl/index.ts"],
    },
  };
}

// ============================================================
// System Prompt
// ============================================================

const JADLIS_SYSTEM_PROMPT = `Ты — Jadlis, персональный ИИ-помощник по улучшению жизни.
Ты помогаешь пользователю отслеживать прогресс по 15 потребностям, ставить цели, формировать привычки, анализировать SWOT и управлять энергией.

Твои инструменты:
- jadlis-supabase: чтение/запись данных пользователя (потребности, метрики, цели, привычки, SWOT, дни, память)
- jadlis-polymarket: prediction markets для контекста решений
- jadlis-firecrawl: скрейпинг веб-страниц для исследований

Принципы:
- Отвечай на русском языке
- Будь проактивным — предлагай улучшения
- Используй данные пользователя для персонализации
- Не выдумывай данные — всегда читай из базы`;

async function buildSystemPromptWith(
  userId: string,
  getWorkingMemory: typeof buildWorkingMemory,
): Promise<string> {
  let workingMemory = "";
  try {
    workingMemory = await getWorkingMemory(userId);
  } catch {
    // Non-fatal: continue with empty working memory
  }

  const parts = [JADLIS_SYSTEM_PROMPT];
  if (workingMemory) {
    parts.push(`\n\n## Рабочая память пользователя\n${workingMemory}`);
  }
  parts.push(`\n\nТекущая дата: ${new Date().toISOString().split("T")[0]}`);

  return parts.join("");
}

// ============================================================
// Hooks
// ============================================================

export function createPreToolUseHook(): HookCallback {
  let callCount = 0;

  return async (input, _toolUseId, _options) => {
    // Validate user_id for supabase tools
    const hookInput = input as { tool_name?: string; tool_input?: Record<string, unknown> };
    if (hookInput.tool_name?.startsWith("jadlis-supabase") && !hookInput.tool_input?.user_id) {
      return {
        hookEventName: "PreToolUse" as const,
        permissionDecision: "deny" as const,
        permissionDecisionReason: "Missing user_id in supabase tool input",
      };
    }

    callCount++;
    if (callCount > MAX_TOOL_CALLS_PER_SESSION) {
      return {
        hookEventName: "PreToolUse" as const,
        permissionDecision: "deny" as const,
        permissionDecisionReason: `Rate limit exceeded: ${MAX_TOOL_CALLS_PER_SESSION} tool calls per session`,
      };
    }

    return {
      hookEventName: "PreToolUse" as const,
      permissionDecision: "allow" as const,
    };
  };
}

export function createPostToolUseHook(): HookCallback {
  return async (input, _toolUseId, _options) => {
    const hookInput = input as {
      tool_name?: string;
      tool_use_id?: string;
      tool_result?: unknown;
      usage?: { cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
    };
    const toolName = hookInput.tool_name ?? "unknown";

    // Audit log (structured for future log aggregation)
    console.log(`[jadlis:agent] tool=${toolName}`);

    // Issue #192: Cache busting monitoring
    const cacheCreation = hookInput.usage?.cache_creation_input_tokens;
    if (cacheCreation && cacheCreation > 0) {
      console.warn(`[jadlis:agent] cache miss detected: tool=${toolName} cache_creation_tokens=${cacheCreation}`);
    }

    return {
      hookEventName: "PostToolUse" as const,
    };
  };
}

// ============================================================
// Subagent Registry (stubs for Splits 03-04)
// ============================================================

const SUBAGENT_REGISTRY: Record<string, SubagentConfig> = {
  "ritual-morning-agent": {
    name: "ritual-morning-agent",
    description: "Handles morning ritual: reviews overnight data, sets daily intention, generates morning briefing.",
  },
  "ritual-evening-agent": {
    name: "ritual-evening-agent",
    description: "Handles evening ritual: reviews day metrics, captures reflections, scores the day.",
  },
  "ritual-weekly-agent": {
    name: "ritual-weekly-agent",
    description: "Handles weekly review: synthesizes week performance, updates goals, generates weekly plan.",
  },
  "news-digest-agent": {
    name: "news-digest-agent",
    description: "Runs news digest pipeline: fetches from 6 sources, runs SWOT analysis, generates briefing.",
  },
  "research-integration-agent": {
    name: "research-integration-agent",
    description: "Parses Ultra Deep Research outputs and analyzes impact on Jadlis elements.",
  },
};

export function getSubagentConfig(name: string): SubagentConfig | null {
  return SUBAGENT_REGISTRY[name] ?? null;
}

// ============================================================
// Main Agent Runner
// ============================================================

export interface AgentDeps {
  buildWorkingMemory: typeof buildWorkingMemory;
  invalidateWorkingMemoryCache: typeof invalidateWorkingMemoryCache;
}

const defaultDeps: AgentDeps = { buildWorkingMemory, invalidateWorkingMemoryCache };

export async function runAgent(
  prompt: string,
  options: AgentRunOptions,
  deps: AgentDeps = defaultDeps,
): Promise<string> {
  const systemPrompt = await buildSystemPromptWith(options.userId, deps.buildWorkingMemory);

  const preToolUse = createPreToolUseHook();
  const postToolUse = createPostToolUseHook();

  // Issue #190: Guard against cloud MCP auto-discovery
  if (!process.env.NO_CLOUD_MCP) {
    process.env.NO_CLOUD_MCP = "true";
  }

  const queryOptions: Options = {
    model: MODEL,
    systemPrompt,
    mcpServers: getMcpServers(),
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    persistSession: false,
    maxTurns: 30,
    tools: [],  // Disable built-in tools; only MCP tools
    hooks: {
      PreToolUse: [{ hooks: [preToolUse] }],
      PostToolUse: [{ hooks: [postToolUse] }],
    },
  };

  const conversation = query({ prompt, options: queryOptions });

  let finalResult = "";

  for await (const message of conversation) {
    if (message.type === "result") {
      if (message.subtype === "success") {
        finalResult = (message as any).result ?? "";
      }
      break;
    }
  }

  // Invalidate working memory cache so next call gets fresh context
  try {
    await deps.invalidateWorkingMemoryCache(options.userId);
  } catch {
    // Non-fatal
  }

  return finalResult;
}
