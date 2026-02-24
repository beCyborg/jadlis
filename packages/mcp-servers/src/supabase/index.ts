import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { semanticSearch, embedText } from "@jadlis/ai";
import { z } from "zod";

// ============================================================
// Client
// ============================================================

function getSupabase(): SupabaseClient {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

let _supabase: SupabaseClient | null = null;
function supabase(): SupabaseClient {
  if (!_supabase) _supabase = getSupabase();
  return _supabase;
}

// ============================================================
// MCP response helpers
// ============================================================

type McpResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(data: unknown): McpResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function err(message: string): McpResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

// ============================================================
// Exported handler functions (testable)
// ============================================================

export async function readNeeds(userId: string): Promise<McpResult> {
  const { data, error } = await supabase()
    .from("needs").select("*").eq("user_id", userId);
  if (error) return err(error.message);
  return ok(data);
}

export async function readMetrics(userId: string, needId?: string): Promise<McpResult> {
  let query = supabase().from("metrics").select("*").eq("user_id", userId);
  if (needId) query = query.eq("need_id", needId);
  const { data, error } = await query;
  if (error) return err(error.message);
  return ok(data);
}

export async function logMetricValue(
  userId: string, metricId: string, value: number, source?: string,
): Promise<McpResult> {
  if (typeof value !== "number" || isNaN(value)) {
    return err("value must be a valid number");
  }
  const { error } = await supabase().from("metric_values").insert({
    user_id: userId,
    metric_id: metricId,
    value,
    source: source ?? "manual",
    recorded_at: new Date().toISOString(),
  });
  if (error) return err(error.message);
  return ok({ success: true });
}

export async function readGoals(userId: string, status?: string): Promise<McpResult> {
  let query = supabase().from("goals").select("*").eq("user_id", userId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return err(error.message);
  return ok(data);
}

export async function updateGoalProgress(
  userId: string, goalId: string, progress: number, status?: string,
): Promise<McpResult> {
  const updates: Record<string, unknown> = { progress };
  if (status) updates.status = status;
  const { error } = await supabase()
    .from("goals").update(updates).eq("id", goalId).eq("user_id", userId);
  if (error) return err(error.message);
  return ok({ success: true });
}

export async function readHabits(userId: string): Promise<McpResult> {
  const { data, error } = await supabase()
    .from("habits").select("*").eq("user_id", userId);
  if (error) return err(error.message);
  return ok(data);
}

export async function logHabitCompletion(
  userId: string, habitId: string, notes?: string,
): Promise<McpResult> {
  const { error: insertError } = await supabase().from("habit_completions").insert({
    user_id: userId,
    habit_id: habitId,
    notes: notes ?? null,
    completed_at: new Date().toISOString(),
  });
  if (insertError) return err(insertError.message);

  // Trigger momentum update via RPC
  const { error: rpcError } = await supabase().rpc("update_habit_momentum", { p_habit_id: habitId });
  if (rpcError) return ok({ success: true, warning: `Momentum update failed: ${rpcError.message}` });

  return ok({ success: true });
}

export async function readDaySummary(userId: string, date: string): Promise<McpResult> {
  const { data, error } = await supabase()
    .from("days").select("*").eq("user_id", userId).eq("date", date).single();
  if (error) return err(error.message);
  return ok(data);
}

export async function writeDaySummary(
  userId: string, date: string, overallScore: number,
  highlights?: unknown[], aiSummary?: string,
): Promise<McpResult> {
  const row: Record<string, unknown> = {
    user_id: userId, date, overall_score: overallScore,
  };
  if (highlights) row.highlights = highlights;
  if (aiSummary) row.ai_summary = aiSummary;

  const { error } = await supabase().from("days").upsert(row, { onConflict: "user_id,date" });
  if (error) return err(error.message);
  return ok({ success: true });
}

export async function readSwot(userId: string, type?: string): Promise<McpResult> {
  let query = supabase().from("swot").select("*").eq("user_id", userId);
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) return err(error.message);
  return ok(data);
}

export async function writeSwotEntry(
  userId: string, type: string, description: string,
  impact: number, probability: number,
  source?: string, affectedGoals?: string[],
): Promise<McpResult> {
  const { error } = await supabase().from("swot").insert({
    user_id: userId, type, description, impact, probability,
    source: source ?? "manual",
    affected_goals: affectedGoals ?? [],
  });
  if (error) return err(error.message);
  return ok({ success: true });
}

export async function readEnergyLeaks(userId: string, status?: string): Promise<McpResult> {
  let query = supabase().from("energy_leaks").select("*").eq("user_id", userId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return err(error.message);
  return ok(data);
}

export async function searchEmbeddings(
  userId: string, query: string,
  sourceTypes?: string[], limit?: number, similarityThreshold?: number,
): Promise<McpResult> {
  try {
    const results = await semanticSearch(query, {
      userId,
      sourceTypes: sourceTypes ?? ["memory_fact", "memory_episode"],
      limit: limit ?? 5,
      similarityThreshold: similarityThreshold ?? 0.7,
    });
    return ok(results);
  } catch (e: any) {
    return err(e.message);
  }
}

export async function readMemoryFacts(userId: string, category?: string): Promise<McpResult> {
  let query = supabase().from("memory_facts").select("*").eq("user_id", userId);
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) return err(error.message);
  return ok(data);
}

export async function writeMemoryFact(
  userId: string, key: string, value: string,
  category: string, confidence?: number, source?: string,
): Promise<McpResult> {
  const { error } = await supabase().from("memory_facts").upsert(
    {
      user_id: userId, key, value, category,
      confidence: confidence ?? 1.0,
      source: source ?? "inferred",
      last_accessed: new Date().toISOString(),
    },
    { onConflict: "user_id,key" },
  );
  if (error) return err(error.message);

  // Also update jadlis_documents for semantic search
  try {
    const embedding = await embedText(value, { inputType: "document" });
    await supabase().from("jadlis_documents").upsert(
      {
        user_id: userId,
        source_type: "memory_fact",
        content: value,
        metadata: { key, category },
        embedding,
      },
      { onConflict: "user_id,source_type,content" },
    );
  } catch {
    // Non-fatal: fact saved but semantic index failed
  }

  return ok({ success: true });
}

export async function readTasks(userId: string, status?: string, stageId?: string): Promise<McpResult> {
  let query = supabase().from("tasks").select("*").eq("user_id", userId);
  if (status) query = query.eq("status", status);
  if (stageId) query = query.eq("stage_id", stageId);
  const { data, error } = await query;
  if (error) return err(error.message);
  return ok(data);
}

// ============================================================
// MCP Server setup
// ============================================================

export function createServer(): McpServer {
  const server = new McpServer({ name: "jadlis-supabase", version: "1.0.0" });

  server.tool("read_needs", "Get all 15 needs with current NeedScore values",
    { user_id: z.string().uuid() },
    async ({ user_id }) => readNeeds(user_id));

  server.tool("read_metrics", "Get metrics, optionally filtered by need",
    { user_id: z.string().uuid(), need_id: z.string().uuid().optional() },
    async ({ user_id, need_id }) => readMetrics(user_id, need_id));

  server.tool("log_metric_value", "Insert a metric value measurement",
    { user_id: z.string().uuid(), metric_id: z.string().uuid(), value: z.number(), source: z.string().optional() },
    async ({ user_id, metric_id, value, source }) => logMetricValue(user_id, metric_id, value, source));

  server.tool("read_goals", "Get goals with optional status filter",
    { user_id: z.string().uuid(), status: z.string().optional() },
    async ({ user_id, status }) => readGoals(user_id, status));

  server.tool("update_goal_progress", "Update goal progress 0-100",
    { user_id: z.string().uuid(), goal_id: z.string().uuid(), progress: z.number().min(0).max(100), status: z.string().optional() },
    async ({ user_id, goal_id, progress, status }) => updateGoalProgress(user_id, goal_id, progress, status));

  server.tool("read_habits", "Get habits with momentum, streak, grace_days",
    { user_id: z.string().uuid() },
    async ({ user_id }) => readHabits(user_id));

  server.tool("log_habit_completion", "Log a habit completion and trigger momentum update",
    { user_id: z.string().uuid(), habit_id: z.string().uuid(), notes: z.string().optional() },
    async ({ user_id, habit_id, notes }) => logHabitCompletion(user_id, habit_id, notes));

  server.tool("read_day_summary", "Get day record for a specific date",
    { user_id: z.string().uuid(), date: z.string() },
    async ({ user_id, date }) => readDaySummary(user_id, date));

  server.tool("write_day_summary", "Upsert day record with score and highlights",
    { user_id: z.string().uuid(), date: z.string(), overall_score: z.number(), highlights: z.array(z.unknown()).optional(), ai_summary: z.string().optional() },
    async ({ user_id, date, overall_score, highlights, ai_summary }) => writeDaySummary(user_id, date, overall_score, highlights, ai_summary));

  server.tool("read_swot", "Get SWOT entries, optionally by type",
    { user_id: z.string().uuid(), type: z.string().optional() },
    async ({ user_id, type }) => readSwot(user_id, type));

  server.tool("write_swot_entry", "Insert a SWOT entry with impact and probability",
    { user_id: z.string().uuid(), type: z.string(), description: z.string(), impact: z.number(), probability: z.number(), source: z.string().optional(), affected_goals: z.array(z.string()).optional() },
    async ({ user_id, type, description, impact, probability, source, affected_goals }) => writeSwotEntry(user_id, type, description, impact, probability, source, affected_goals));

  server.tool("read_energy_leaks", "Get energy leaks, optionally by status",
    { user_id: z.string().uuid(), status: z.string().optional() },
    async ({ user_id, status }) => readEnergyLeaks(user_id, status));

  server.tool("search_embeddings", "Semantic search via jadlis_documents",
    { user_id: z.string().uuid(), query: z.string(), source_types: z.array(z.string()).optional(), limit: z.number().optional(), similarity_threshold: z.number().optional() },
    async ({ user_id, query, source_types, limit, similarity_threshold }) => searchEmbeddings(user_id, query, source_types, limit, similarity_threshold));

  server.tool("read_memory_facts", "Get memory facts from memory_facts table",
    { user_id: z.string().uuid(), category: z.string().optional() },
    async ({ user_id, category }) => readMemoryFacts(user_id, category));

  server.tool("write_memory_fact", "Upsert memory fact + update semantic index",
    { user_id: z.string().uuid(), key: z.string(), value: z.string(), category: z.string(), confidence: z.number().optional(), source: z.string().optional() },
    async ({ user_id, key, value, category, confidence, source }) => writeMemoryFact(user_id, key, value, category, confidence, source));

  server.tool("read_tasks", "Get tasks, optionally filtered by status/stage",
    { user_id: z.string().uuid(), status: z.string().optional(), stage_id: z.string().uuid().optional() },
    async ({ user_id, status, stage_id }) => readTasks(user_id, status, stage_id));

  return server;
}

// ============================================================
// Entry point
// ============================================================

if (import.meta.main) {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
