import { createApp } from "./server";
import { bot } from "./bot";
import { supabase } from "./db";

const app = createApp({ bot, supabase });

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};
