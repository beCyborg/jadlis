import { Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type ApiEnv, resolveDbUser } from "./types";

export function createDaysRouter(supabase: SupabaseClient) {
  const router = new Hono<ApiEnv>();

  router.get("/", async (c) => {
    const dbUser = await resolveDbUser(c, supabase);
    if (dbUser instanceof Response) return dbUser;

    const rangeParam = c.req.query("range");
    const range = Math.min(Math.max(Number(rangeParam) || 7, 1), 90);

    const { data, error } = await supabase
      .from("days")
      .select("*")
      .eq("user_id", dbUser.id)
      .order("date", { ascending: false })
      .limit(range);

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  });

  return router;
}
