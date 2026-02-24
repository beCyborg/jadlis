import { Bot } from "grammy";

const bot = new Bot(process.env.BOT_TOKEN!);
const webhookUrl = `${process.env.RAILWAY_URL}/webhook/${process.env.BOT_TOKEN}`;

await bot.api.setWebhook(webhookUrl, {
  secret_token: process.env.WEBHOOK_SECRET!,
});
console.log(`Webhook registered: ${webhookUrl}`);
