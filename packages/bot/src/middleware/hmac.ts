import { validate } from "@tma.js/init-data-node/web";
import type { MiddlewareHandler } from "hono";
import type { ApiEnv } from "../api/types";

/**
 * Validates Telegram Mini App initData from X-Telegram-Init-Data header.
 * Rejects requests older than 24 hours (expiresIn: 86400).
 * On success, extracts user info and sets c.set("telegramUser", ...).
 */
export const hmacMiddleware: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const initData = c.req.header("X-Telegram-Init-Data");
  if (!initData) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    await validate(initData, process.env.BOT_TOKEN!, { expiresIn: 86400 });

    // Parse user from initData query string
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        c.set("telegramUser", user);
      } catch {
        // user parse failed, but validation passed — continue without user context
      }
    }

    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
};
