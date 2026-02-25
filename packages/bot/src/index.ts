import { createApp } from "./server";
import { bot } from "./bot";
import { supabase } from "./db";
import { createNotificationWorker, reconcileAllSchedules, getNotificationQueue } from "./queue";

const app = createApp({ bot, supabase });

// Initialize notification worker with bot.api (DI, no circular imports)
const worker = createNotificationWorker(bot.api);

// Reconcile user notification schedules on startup (async, non-blocking)
reconcileAllSchedules(supabase).catch((err) =>
  console.error("[startup] Schedule reconciliation failed:", err),
);

// Graceful shutdown: close worker + queue before exit
async function shutdown() {
  console.log("[shutdown] Closing worker and queue...");
  await worker.close();
  await getNotificationQueue().close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};
