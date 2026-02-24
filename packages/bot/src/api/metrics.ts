import { Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createMetricsRouter(supabase: SupabaseClient) {
  const router = new Hono();

  // GET /api/metrics/:needId — stub, full impl in Split 06
  router.get("/:needId", async (c) => {
    return c.json([]);
  });

  return router;
}
