import { Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hmacMiddleware } from "../middleware/hmac";
import { createNeedsRouter } from "./needs";
import { createHabitsRouter } from "./habits";
import { createGoalsRouter } from "./goals";
import { createDaysRouter } from "./days";
import { createMetricsRouter } from "./metrics";

export function createApiRouter(supabase: SupabaseClient) {
  const api = new Hono();

  api.use("*", hmacMiddleware);

  api.route("/needs", createNeedsRouter(supabase));
  api.route("/metrics", createMetricsRouter(supabase));
  api.route("/habits", createHabitsRouter(supabase));
  api.route("/goals", createGoalsRouter(supabase));
  api.route("/days", createDaysRouter(supabase));

  return api;
}
