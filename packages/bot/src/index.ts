import { createApp } from "./server";
import { bot } from "./bot";

const app = createApp({ bot });

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};
