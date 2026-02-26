import type { SupabaseClient } from "@supabase/supabase-js";
import type { NeuroBalanceZone } from "@jadlis/shared";
import { normalizeMetric } from "@jadlis/shared";

/**
 * Lazy import @jadlis/ai to avoid module mock conflicts in test suite.
 * These functions are used in fire-and-forget patterns, so the lazy import
 * cost is negligible.
 */
async function getAiModule() {
  return await import("@jadlis/ai");
}

/**
 * Metric codes for morning ratings.
 */
export const METRIC_CODES = {
  physical: "H01",
  emotional: "H02",
  energy: "H03",
} as const;

/**
 * Records a morning rating metric value.
 * Looks up metric by code, normalizes value, inserts into metric_values.
 */
export async function recordMorningMetric(
  userId: string,
  code: string,
  rawValue: number,
  supabase: SupabaseClient,
): Promise<void> {
  const { data: metric } = await supabase
    .from("metrics")
    .select("id, scale_type, scale_min, scale_max")
    .eq("user_id", userId)
    .eq("code", code)
    .maybeSingle();

  if (!metric) {
    console.warn(`[memoryIntegration] Metric ${code} not found for user ${userId}`);
    return;
  }

  const normalized = normalizeMetric(rawValue, {
    type: "P1",
    min: metric.scale_min ?? 1,
    max: metric.scale_max ?? 10,
  });

  const { error } = await supabase.from("metric_values").insert({
    metric_id: metric.id,
    user_id: userId,
    value: rawValue,
    normalized_value: normalized,
    source: "morning_checkin",
    recorded_at: new Date().toISOString(),
  });

  if (error) {
    console.warn(`[memoryIntegration] Failed to record metric ${code}: ${error.message}`);
  }
}

/**
 * Fire-and-forget: update working memory cache after morning check-in.
 */
export async function updateWorkingMemoryAfterMorning(
  userId: string,
  _zone: NeuroBalanceZone,
  _plan: string,
): Promise<void> {
  const { invalidateWorkingMemoryCache } = await getAiModule();
  await invalidateWorkingMemoryCache(userId);
}

/**
 * Fire-and-forget: run all post-evening async actions.
 * 1. Embed highlights
 * 2. Embed resistance (if significant)
 * 3. Invalidate working memory cache
 * 4. Check episode summarization threshold
 */
export async function runPostEveningActions(
  userId: string,
  highlights: string,
  resistance: string,
  supabase: SupabaseClient,
): Promise<void> {
  const ai = await getAiModule();

  // 1. Embed highlights
  if (highlights.trim().length > 0) {
    try {
      const embedding = await ai.embedText(highlights, { inputType: "document" });
      await supabase.from("jadlis_documents").insert({
        user_id: userId,
        content: highlights,
        embedding,
        source_type: "reflection",
        metadata: { date: new Date().toISOString().slice(0, 10) },
      });
    } catch (err) {
      console.warn("[memoryIntegration] Failed to embed highlights:", err);
    }
  }

  // 2. Embed resistance (if significant: length > 20 and not trivial)
  const trivial = ["нет", "-", "—", ""];
  if (resistance.trim().length > 20 && !trivial.includes(resistance.trim().toLowerCase())) {
    try {
      const embedding = await ai.embedText(resistance, { inputType: "document" });
      await supabase.from("jadlis_documents").insert({
        user_id: userId,
        content: resistance,
        embedding,
        source_type: "energy_leak",
        metadata: { date: new Date().toISOString().slice(0, 10) },
      });
    } catch (err) {
      console.warn("[memoryIntegration] Failed to embed resistance:", err);
    }
  }

  // 3. Invalidate working memory cache
  await ai.invalidateWorkingMemoryCache(userId);

  // 4. Check episode summarization threshold
  try {
    const { count } = await supabase
      .from("bot_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (count !== null && ai.shouldTriggerEpisodeSummarization(count)) {
      // Fetch recent messages for summarization
      const { data: messages } = await supabase
        .from("bot_sessions")
        .select("role, content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (messages && messages.length > 0) {
        await ai.summarizeAndStoreEpisode(
          userId,
          messages as Array<{ role: "user" | "assistant"; content: string }>,
        );
      }
    }
  } catch (err) {
    console.warn("[memoryIntegration] Episode summarization check failed:", err);
  }
}
