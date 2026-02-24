import { Hono } from "hono";
import { webhookCallback } from "grammy";
import type { Bot } from "grammy";

export function createApp(deps: { bot: Bot<any> | null }) {
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

  return app;
}
