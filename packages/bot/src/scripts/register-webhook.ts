import { createHash } from "crypto";
import { Bot } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);

// Must match the hashed path in server.ts
const webhookPath = createHash("sha256")
  .update(process.env.BOT_TOKEN!)
  .digest("hex")
  .slice(0, 32);

const webhookUrl = `${process.env.RAILWAY_URL}/webhook/${webhookPath}`;

await bot.api.setWebhook(webhookUrl, {
  secret_token: process.env.WEBHOOK_SECRET!,
});
console.log(`Webhook registered: ${webhookUrl}`);
