import type { Conversation } from "@grammyjs/conversations";
import type { BotContext, AuthedContext } from "../bot";
import { sendRatingKeyboard, waitForRating, sendConfirmKeyboard } from "./utils";
import {
  createMessage,
  createMessageWithTools,
  buildZonePrompt,
  buildMorningPlanPrompt,
  DETERMINE_ZONE_TOOL,
  buildWorkingMemory,
  invalidateWorkingMemoryCache,
} from "@jadlis/ai";
import type { ZoneDetermination } from "@jadlis/ai";
import { normalizeMetric, levelToZone } from "@jadlis/shared";
import type { NeuroBalanceZone } from "@jadlis/shared";
import { supabase } from "../db";
import { getOrCreateTodayRecord, updateDayField } from "../services/dayService";

const ZONE_EMOJIS: Record<NeuroBalanceZone, string> = {
  crisis: "\u{1F534}",
  exhaustion: "\u{1F7E0}",
  decline: "\u{1F7E1}",
  stable: "\u26AA",
  rise: "\u{1F7E2}",
  flow: "\u{1F49A}",
  superflow: "\u{1F48E}",
};

const ZONE_NAMES: Record<NeuroBalanceZone, string> = {
  crisis: "\u041A\u0440\u0438\u0437\u0438\u0441",
  exhaustion: "\u0418\u0441\u0442\u043E\u0449\u0435\u043D\u0438\u0435",
  decline: "\u0421\u043F\u0430\u0434",
  stable: "\u0421\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0441\u0442\u044C",
  rise: "\u041F\u043E\u0434\u044A\u0451\u043C",
  flow: "\u041F\u043E\u0442\u043E\u043A",
  superflow: "\u0421\u0443\u043F\u0435\u0440\u043F\u043E\u0442\u043E\u043A",
};

/**
 * Fetch user's tasks/habits/goals and generate a plan via AI.
 * Extracted to avoid duplication between initial and edit paths.
 */
async function generatePlan(
  userId: string,
  chatId: string,
  zone: NeuroBalanceZone,
  zoneLevel: number,
  customInstruction?: string,
): Promise<string> {
  const workingMemory = await buildWorkingMemory(userId, chatId);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, priority")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .limit(10);

  const { data: habits } = await supabase
    .from("habits")
    .select("name, momentum")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(10);

  const { data: goals } = await supabase
    .from("goals")
    .select("title, deadline")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(5);

  const prompt = buildMorningPlanPrompt(
    zone,
    zoneLevel,
    tasks ?? [],
    habits ?? [],
    goals ?? [],
    workingMemory,
    customInstruction,
  );

  return createMessage(prompt, { maxTokens: 2048 });
}

/**
 * Morning CORE check-in conversation.
 *
 * Collects 3 state ratings, determines NeuroBalance zone via AI,
 * generates a zone-aware daily plan, and persists results to days table.
 *
 * Registered in conversations/index.ts as "morningCheckin".
 * Entry point: ctx.conversation.enter("morningCheckin")
 */
export async function morningCheckin(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
): Promise<void> {
  const userId = (ctx as AuthedContext).userId;
  const chatId = String(ctx.chat?.id ?? "");

  // ── 1-3. Collect 3 ratings ────────────────────────────────

  await sendRatingKeyboard(ctx, "\u0414\u043E\u0431\u0440\u043E\u0435 \u0443\u0442\u0440\u043E! \u2600\uFE0F\n\u041A\u0430\u043A \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435?", "rating_h01");
  const physical = await waitForRating(conversation, "rating_h01");

  await sendRatingKeyboard(ctx, "\u042D\u043C\u043E\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435?", "rating_h02");
  const emotional = await waitForRating(conversation, "rating_h02");

  await sendRatingKeyboard(ctx, "\u0423\u0440\u043E\u0432\u0435\u043D\u044C \u044D\u043D\u0435\u0440\u0433\u0438\u0438/\u043C\u043E\u0442\u0438\u0432\u0430\u0446\u0438\u0438?", "rating_h03");
  const energy = await waitForRating(conversation, "rating_h03");

  // ── 4. Record metrics ─────────────────────────────────────

  await conversation.external(async () => {
    const ratings: Array<[string, number]> = [
      ["H01", physical],
      ["H02", emotional],
      ["H03", energy],
    ];

    for (const [code, value] of ratings) {
      const { data: metric } = await supabase
        .from("metrics")
        .select("id, type, min_value, max_value")
        .eq("code", code)
        .eq("user_id", userId)
        .single();

      if (!metric) {
        console.warn(`[morningCheckin] Metric ${code} not found for user ${userId}`);
      }

      const normalized = metric
        ? normalizeMetric(value, { type: "P1", min: 1, max: 10 })
        : null;

      const { error } = await supabase.from("metric_values").insert({
        metric_id: metric?.id ?? null,
        user_id: userId,
        raw_value: value,
        normalized_value: normalized,
        source: "morning_checkin",
        recorded_at: new Date().toISOString(),
      });

      if (error) {
        console.error(`[morningCheckin] Failed to insert metric ${code}:`, error);
      }
    }
  });

  // ── 5. Zone determination ─────────────────────────────────

  let zone: NeuroBalanceZone;
  let zoneLevel: number;

  try {
    const result = await conversation.external(async () => {
      const workingMemory = await buildWorkingMemory(userId, chatId);
      const response = await createMessageWithTools(
        buildZonePrompt({ physical, emotional, energy }, workingMemory),
        {
          tools: [DETERMINE_ZONE_TOOL],
          tool_choice: { type: "tool" as const, name: "determine_zone" },
          maxTokens: 256,
        },
      );

      const toolUse = response.content.find(
        (b: { type: string }) => b.type === "tool_use",
      );
      if (!toolUse) throw new Error("No tool_use block in response");

      const input = (toolUse as { input: ZoneDetermination }).input;
      return { zone: input.zone, zoneLevel: input.zoneLevel };
    });

    zone = result.zone;
    zoneLevel = result.zoneLevel;
  } catch (err) {
    console.warn("[morningCheckin] Zone AI failed, using formula fallback:", err);
    const avg = (physical + emotional + energy) / 3;
    zoneLevel = Math.round((avg * 7) / 10);
    zone = levelToZone(zoneLevel);
  }

  // ── 6. Plan generation ────────────────────────────────────

  let plan: string | null = null;

  try {
    plan = await conversation.external(() =>
      generatePlan(userId, chatId, zone, zoneLevel),
    );
  } catch (err) {
    console.error("[morningCheckin] Plan generation failed:", err);
    await conversation.external(async () => {
      await getOrCreateTodayRecord(userId, supabase);
      await updateDayField(userId, "zone", zone, supabase);
    });
    ctx.session.step = "idle";
    ctx.session.current_ritual = null;
    await ctx.reply("\u0410\u0049-\u0430\u043D\u0430\u043B\u0438\u0437 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 /status \u0434\u043B\u044F \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430 \u0437\u0430\u0434\u0430\u0447.");
    return;
  }

  // ── 7. Show zone + plan to user ──────────────────────────

  const header = `${ZONE_EMOJIS[zone]} \u0417\u043E\u043D\u0430: ${ZONE_NAMES[zone]} (${zoneLevel}/7)\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`;

  await sendConfirmKeyboard(ctx, `${header}\n${plan}`);

  // ── 8. Handle user choice ─────────────────────────────────

  let finalPlan: string | null = plan;
  let confirmed = false;

  while (!confirmed) {
    const confirmCtx = await conversation.waitForCallbackQuery(
      /^confirm:(accept|edit|skip)$/,
      {
        otherwise: (c: BotContext) =>
          c.reply("\u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043A\u043D\u043E\u043F\u043A\u0438 \u0432\u044B\u0448\u0435."),
      },
    );
    await confirmCtx.answerCallbackQuery();
    const choice = confirmCtx.callbackQuery.data.split(":")[1];

    if (choice === "accept") {
      confirmed = true;
    } else if (choice === "edit") {
      await ctx.reply("\u041E\u043F\u0438\u0448\u0438\u0442\u0435, \u0447\u0442\u043E \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0432 \u043F\u043B\u0430\u043D\u0435:");
      const editCtx = await conversation.waitFor("message:text");
      const customInstruction = editCtx.message!.text;

      finalPlan = await conversation.external(() =>
        generatePlan(userId, chatId, zone, zoneLevel, customInstruction),
      );

      await sendConfirmKeyboard(ctx, `${header}\n${finalPlan}`);
    } else {
      // skip
      finalPlan = null;
      confirmed = true;
    }
  }

  // ── 9. Save zone + plan ───────────────────────────────────

  await conversation.external(async () => {
    await getOrCreateTodayRecord(userId, supabase);
    await updateDayField(userId, "zone", zone, supabase);
    if (finalPlan) {
      await updateDayField(userId, "morning_plan", finalPlan, supabase);
    }
  });

  // ── 10. Session cleanup ───────────────────────────────────

  ctx.session.step = "idle";
  ctx.session.current_ritual = null;

  try {
    await conversation.external(async () => {
      await invalidateWorkingMemoryCache(userId);
    });
  } catch {
    // Non-critical — cache will expire naturally
  }

  await ctx.reply(
    finalPlan
      ? "\u2705 \u041F\u043B\u0430\u043D \u0434\u043D\u044F \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D. \u0425\u043E\u0440\u043E\u0448\u0435\u0433\u043E \u0434\u043D\u044F!"
      : "\u2705 \u0417\u043E\u043D\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0430. \u0425\u043E\u0440\u043E\u0448\u0435\u0433\u043E \u0434\u043D\u044F!",
  );
}
