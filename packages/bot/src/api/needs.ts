import { Hono } from "hono";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createNeedsRouter(supabase: SupabaseClient) {
  const router = new Hono();

  router.get("/", async (c) => {
    const user = c.get("telegramUser") as { id: number } | undefined;
    if (!user) return c.json({ error: "No user context" }, 400);

    const { data: dbUser } = await supabase
      .from("users")
      .select("id")
      .eq("telegram_id", user.id)
      .single();

    if (!dbUser) return c.json({ error: "User not found" }, 404);

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
