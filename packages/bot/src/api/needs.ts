import { Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type ApiEnv, resolveDbUser } from "./types";

export function createNeedsRouter(supabase: SupabaseClient) {
  const router = new Hono<ApiEnv>();

  router.get("/", async (c) => {
    const dbUser = await resolveDbUser(c, supabase);
    if (dbUser instanceof Response) return dbUser;

    const { data, error } = await supabase
      .from("needs")
      .select("*")
      .eq("user_id", dbUser.id)
      .order("name");

    if (error) return c.json({ error: error.message }, 500);
    return c.json(data);
  });

  return router;
}
