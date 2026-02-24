import { Hono } from "hono";
import { webhookCallback } from "grammy";
import type { Bot } from "grammy";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createApiRouter } from "./api/index";
import { createIngestRouter } from "./ingest/health";
import { timingSafeCompare } from "./utils/crypto";

interface AppDeps {
  bot: Bot<any> | null;
  supabase: SupabaseClient;
}

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.get("/health", (c) => {
    return c.json({ ok: true, uptime: process.uptime() });
  });

  // Telegram webhook — BOT_TOKEN in path + secret token validation
  if (deps.bot) {
    app.post(
      `/webhook/${process.env.BOT_TOKEN}`,
      webhookCallback(deps.bot, "hono", {
        secretToken: process.env.WEBHOOK_SECRET,
      }),
    );
  }

  // Mini App API routes (HMAC-protected)
  app.route("/api", createApiRouter(deps.supabase));

  // Health Auto Export ingest (Bearer token)
  app.route("/ingest", createIngestRouter(deps.supabase));

  // Cron endpoint (Bearer CRON_SECRET)
  app.post("/cron/daily-digest", async (c) => {
    const auth = c.req.header("Authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!auth || !timingSafeCompare(auth, expected)) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    // TODO (section-10): trigger daily digest agent
    return c.json({ ok: true });
  });

  return app;
}
