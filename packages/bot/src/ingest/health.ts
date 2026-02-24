import { Hono } from "hono";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMetric, type ScaleConfig } from "@jadlis/shared";
import { timingSafeCompare } from "../utils/crypto";

// HAE metric name -> Jadlis metric code
export const HAE_TO_JADLIS_METRIC: Record<string, string> = {
  sleep_analysis: "S02",
  step_count: "M04",
  heart_rate: "H07",
  active_energy: "M01",
};

const HealthPayloadSchema = z.object({
  data: z.object({
    metrics: z.array(
      z.object({
        name: z.string(),
        units: z.string(),
        data: z.array(
          z.object({
            qty: z.number(),
            date: z.string(),
          }),
        ),
      }),
    ),
  }),
});

function buildScaleConfig(row: {
  scale_type: string;
  scale_min: number;
  scale_max: number;
  scale_target?: number;
  scale_threshold?: number;
}): ScaleConfig {
  switch (row.scale_type) {
    case "P3":
      return { type: "P3", min: row.scale_min, max: row.scale_max, target: row.scale_target ?? row.scale_min };
    case "P4":
      return { type: "P4", threshold: row.scale_threshold ?? 0 };
    case "P2":
      return { type: "P2", min: row.scale_min, max: row.scale_max };
    default:
      return { type: "P1", min: row.scale_min, max: row.scale_max };
  }
}

export function createIngestRouter(supabase: SupabaseClient) {
  const router = new Hono();

  router.post("/health", async (c) => {
    // Auth check — timing-safe
    const auth = c.req.header("Authorization");
    const expected = `Bearer ${process.env.HAE_INGEST_SECRET}`;
    if (!auth || !timingSafeCompare(auth, expected)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Parse JSON with error handling
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    // Zod validate
    const parsed = HealthPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "Invalid payload", details: parsed.error.issues }, 400);
    }

    const { metrics } = parsed.data.data;
    let inserted = 0;

    for (const metric of metrics) {
      const jadlisCode = HAE_TO_JADLIS_METRIC[metric.name];
      if (!jadlisCode) continue;

      const { data: metricRow } = await supabase
        .from("metrics")
        .select("id, scale_type, scale_min, scale_max, scale_target, scale_threshold")
        .eq("code", jadlisCode)
        .single();

      if (!metricRow) continue;

      const scaleConfig = buildScaleConfig(metricRow);

      for (const point of metric.data) {
        const dateStr = new Date(point.date).toISOString().split("T")[0];
        const normalizedValue = normalizeMetric(point.qty, scaleConfig);

        await supabase.from("metric_values").upsert(
          {
            metric_id: metricRow.id,
            value: point.qty,
            normalized_value: normalizedValue,
            recorded_at: dateStr,
            source: "auto" as const,
          },
          { onConflict: "metric_id,recorded_at" },
        );

        inserted++;
      }
    }

    return c.json({ ok: true, inserted });
  });

  return router;
}
