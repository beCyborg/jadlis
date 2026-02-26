import type { Conversation } from "@grammyjs/conversations";
import type { BotContext, AuthedContext } from "../bot";
import {
  sendRatingKeyboard,
  waitForRating,
  sendMultiSelectKeyboard,
} from "./utils";
import {
  createMessage,
  buildTaskTransferPrompt,
  buildTomorrowPlanPrompt,
  buildDaySummaryPrompt,
  buildWorkingMemory,
  invalidateWorkingMemoryCache,
  embedText,
  shouldTriggerEpisodeSummarization,
} from "@jadlis/ai";
import { supabase } from "../db";
import {
  isEveningCompleted,
  updateDayField,
  appendHighlight,
  getOrCreateTodayRecord,
} from "../services/dayService";
import { fallbackTaskTransfer } from "../utils/aiFallbacks";
import {
  getTodayTasks,
  updateTaskStatus,
  transferTaskToDate,
  deferTask,
  createTasksForDate,
} from "../services/taskService";
import {
  getTodayHabits,
  logHabitCompletion,
} from "../services/habitService";

const SKIP_WORDS = new Set(["нет", "-"]);
const MAX_DISPLAYED_TASKS = 10;

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Evening CORE ritual — Scanner Conversation.
 *
 * 5-step flow: Highlight → Rating → Task/Habit Review → Resistance → Tomorrow Plan.
 * All side-effects wrapped in conversation.external().
 * Embeddings deferred to post-conversation.
 *
 * Registered in conversations/index.ts as "eveningScanner".
 */
export async function eveningScanner(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
): Promise<void> {
  const userId = (ctx as AuthedContext).userId;
  const chatId = String(ctx.chat?.id ?? "");
  const today = getToday();
  const tomorrow = getTomorrow();

  // ── Duplicate protection ────────────────────────────────────

  const alreadyDone = await conversation.external(() =>
    isEveningCompleted(userId, supabase),
  );
  if (alreadyDone) {
    await ctx.reply("Вечерний сканер уже пройден сегодня.");
    return;
  }

  // Ensure day record exists
  await conversation.external(() => getOrCreateTodayRecord(userId, supabase));

  // Local state for post-conversation async
  let highlightText: string | null = null;
  let resistanceText: string | null = null;
  const transferredTasks: Array<{ id: string; title: string }> = [];

  // ── Step 1: Замечательный момент (Д4) ─────────────────────

  await ctx.reply("Что было замечательного сегодня? Поделитесь одним моментом.");
  const highlightCtx = await conversation.waitFor("message:text");
  highlightText = highlightCtx.message!.text;

  await conversation.external(() =>
    appendHighlight(userId, highlightText!, supabase),
  );

  // ── Step 2: Оценка дня (Д5) ──────────────────────────────

  await sendRatingKeyboard(ctx, "Оцените день в целом:", "evening_score");
  const score = await waitForRating(conversation, "evening_score");

  // Optional comment
  await ctx.reply("Краткий комментарий? (или нажмите Пропустить)", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Пропустить →", callback_data: "skip_comment" }],
      ],
    },
  });

  let dayComment: string | null = null;
  const commentCtx = await conversation.waitFor(["message:text", "callback_query:data"]);
  if (commentCtx.callbackQuery?.data === "skip_comment") {
    await commentCtx.answerCallbackQuery();
  } else if (commentCtx.message?.text) {
    dayComment = commentCtx.message.text;
  }

  await conversation.external(async () => {
    await updateDayField(userId, "overall_score", score, supabase);
    // Store comment as part of highlights if provided
    if (dayComment) {
      await appendHighlight(userId, `Комментарий к дню: ${dayComment}`, supabase);
    }
  });

  // ── Step 3: Task Review (Д6a) ─────────────────────────────

  const tasks = await conversation.external(() =>
    getTodayTasks(userId, supabase),
  );

  // Only display first 10 tasks; undisplayed tasks are left untouched
  const displayedTasks = tasks.slice(0, MAX_DISPLAYED_TASKS);
  let completedTaskIds: string[] = [];

  if (displayedTasks.length > 0) {
    const taskItems = displayedTasks.map((t) => ({ id: t.id, label: t.title }));

    if (tasks.length > MAX_DISPLAYED_TASKS) {
      await ctx.reply(`Показаны первые ${MAX_DISPLAYED_TASKS} задач. Остальные доступны через /status`);
    }

    completedTaskIds = await sendMultiSelectKeyboard(
      conversation,
      ctx,
      taskItems,
      "task_select",
    );

    // Mark completed tasks
    if (completedTaskIds.length > 0) {
      await conversation.external(async () => {
        for (const taskId of completedTaskIds) {
          await updateTaskStatus(taskId, "done", supabase);
        }
      });
    }
  }

  // ── Step 3b: Habit Review ─────────────────────────────────

  const habits = await conversation.external(() =>
    getTodayHabits(userId, supabase),
  );

  if (habits.length > 0) {
    const habitItems = habits.map((h) => ({ id: h.id, label: h.name }));

    const completedHabitIds = await sendMultiSelectKeyboard(
      conversation,
      ctx,
      habitItems,
      "habit_select",
    );

    if (completedHabitIds.length > 0) {
      await conversation.external(async () => {
        for (const habitId of completedHabitIds) {
          await logHabitCompletion(habitId, userId, supabase);
        }
      });
    }
  }

  // ── Step 3c: Incomplete Task Actions ──────────────────────
  // Only process displayed tasks that weren't completed — undisplayed tasks left untouched

  const incompleteTasks = displayedTasks.filter((t) => !completedTaskIds.includes(t.id));

  if (incompleteTasks.length > 0) {
    const suggestions = await conversation.external(async (): Promise<Array<{ taskId: string; action: string; reasoning: string }>> => {
      try {
        const prompt = buildTaskTransferPrompt(
          incompleteTasks.map((t) => ({ id: t.id, title: t.title })),
          `Оценка дня: ${score}/10`,
        );
        const raw = await createMessage(prompt, { maxTokens: 1024 });
        return JSON.parse(raw);
      } catch (err) {
        console.warn("[eveningScanner] Task transfer AI failed, using fallback:", err);
        return fallbackTaskTransfer(incompleteTasks);
      }
    });

    for (const suggestion of suggestions) {
      const task = incompleteTasks.find((t) => t.id === suggestion.taskId);
      if (!task) continue;

      const actionLabel =
        suggestion.action === "transfer" ? "Перенести" :
        suggestion.action === "defer" ? "Отложить" : "Отменить";

      await ctx.reply(
        `Задача: ${task.title}\nAI рекомендует: ${actionLabel}\n${suggestion.reasoning}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Согласен ✓", callback_data: `task_action:accept:${task.id}` },
                { text: "Изменить ✏️", callback_data: `task_action:change:${task.id}` },
              ],
            ],
          },
        },
      );

      const actionCtx = await conversation.waitForCallbackQuery(
        new RegExp(`^task_action:(accept|change):${task.id}$`),
        {
          otherwise: (c: BotContext) => c.reply("Используйте кнопки для выбора."),
        },
      );
      await actionCtx.answerCallbackQuery();

      const userChoice = actionCtx.callbackQuery.data.split(":")[1];
      let finalAction = suggestion.action;

      if (userChoice === "change") {
        await ctx.reply(`Что сделать с "${task.title}"?`, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Перенести", callback_data: `task_override:transfer:${task.id}` },
                { text: "Отложить", callback_data: `task_override:defer:${task.id}` },
                { text: "Отменить", callback_data: `task_override:cancel:${task.id}` },
              ],
            ],
          },
        });

        const overrideCtx = await conversation.waitForCallbackQuery(
          new RegExp(`^task_override:(transfer|defer|cancel):${task.id}$`),
          {
            otherwise: (c: BotContext) => c.reply("Используйте кнопки для выбора."),
          },
        );
        await overrideCtx.answerCallbackQuery();
        finalAction = overrideCtx.callbackQuery.data.split(":")[1];
      }

      // Apply action
      await conversation.external(async () => {
        if (finalAction === "transfer") {
          await transferTaskToDate(task.id, tomorrow, supabase);
          transferredTasks.push({ id: task.id, title: task.title });
        } else if (finalAction === "defer") {
          await deferTask(task.id, supabase);
        } else {
          await updateTaskStatus(task.id, "cancelled", supabase);
        }
      });
    }
  }

  // ── Step 4: Сопротивление (Д7) ───────────────────────────

  await ctx.reply("Что вызвало сопротивление сегодня? (напишите или нажмите Пропустить)", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Пропустить →", callback_data: "skip_resistance" }],
      ],
    },
  });

  const resistanceCtx = await conversation.waitFor(["message:text", "callback_query:data"]);
  if (resistanceCtx.callbackQuery?.data === "skip_resistance") {
    await resistanceCtx.answerCallbackQuery();
    resistanceText = null;
  } else if (resistanceCtx.message?.text) {
    const text = resistanceCtx.message.text;
    if (SKIP_WORDS.has(text.toLowerCase().trim())) {
      resistanceText = null;
    } else {
      resistanceText = text;
      await conversation.external(async () => {
        const { error } = await supabase.from("energy_leaks").insert({
          user_id: userId,
          description: resistanceText,
          recorded_at: new Date().toISOString(),
        });
        if (error) {
          console.error("[eveningScanner] Failed to insert energy leak:", error.message);
        }
      });
    }
  }

  // ── Step 5: Plan Tomorrow (Д8) ───────────────────────────

  // Fetch context once, reuse for regeneration
  const planContext = await conversation.external(async () => {
    const workingMemory = await buildWorkingMemory(userId, chatId);

    const { data: goals } = await supabase
      .from("goals")
      .select("title, deadline")
      .eq("user_id", userId)
      .eq("status", "active")
      .lte("deadline", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));

    const { data: recentDays } = await supabase
      .from("days")
      .select("highlights")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(3);

    const recentHighlights = (recentDays ?? [])
      .flatMap((d: { highlights: unknown }) =>
        Array.isArray(d.highlights) ? d.highlights : [],
      ) as string[];

    const { data: todayDay } = await supabase
      .from("days")
      .select("zone")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    return {
      workingMemory,
      activeGoals: (goals ?? []) as Array<{ title: string; deadline?: string }>,
      recentHighlights,
      todayZone: todayDay?.zone ?? null,
    };
  });

  const parsed = await conversation.external(async (): Promise<{ plan: string; tasks: Array<{ title: string; priority: "high" | "medium" | "low" }>; joyTask: { title: string; reasoning: string } }> => {
    try {
      const prompt = buildTomorrowPlanPrompt(
        transferredTasks,
        planContext.activeGoals,
        planContext.workingMemory,
        planContext.recentHighlights,
        planContext.todayZone,
      );
      const raw = await createMessage(prompt, { maxTokens: 2048 });
      return JSON.parse(raw);
    } catch (err) {
      console.warn("[eveningScanner] Tomorrow plan AI failed, using fallback:", err);
      return {
        plan: "AI-план временно недоступен. Задачи перенесены автоматически.",
        tasks: [] as Array<{ title: string; priority: "high" | "medium" | "low" }>,
        joyTask: { title: "Приятная прогулка", reasoning: "Время для себя" },
      };
    }
  });

  // Show plan
  await ctx.reply(`План на завтра:\n\n${parsed.plan}\n\nРадость дня: ${parsed.joyTask.title}`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Принять ✓", callback_data: "plan:accept" },
          { text: "Изменить ✏️", callback_data: "plan:edit" },
        ],
      ],
    },
  });

  let finalPlan = parsed;
  let planConfirmed = false;

  while (!planConfirmed) {
    const planCtx = await conversation.waitForCallbackQuery(
      /^plan:(accept|edit)$/,
      {
        otherwise: (c: BotContext) => c.reply("Используйте кнопки для выбора."),
      },
    );
    await planCtx.answerCallbackQuery();

    const choice = planCtx.callbackQuery.data.split(":")[1];

    if (choice === "accept") {
      planConfirmed = true;
    } else {
      await ctx.reply("Что изменить в плане?");
      const editCtx = await conversation.waitFor("message:text");
      const adjustment = editCtx.message!.text;

      const regenResult = await conversation.external(async () => {
        const prompt = buildTomorrowPlanPrompt(
          transferredTasks,
          planContext.activeGoals,
          planContext.workingMemory,
          planContext.recentHighlights,
          planContext.todayZone,
        ) + `\n\nПожелания пользователя: ${adjustment}`;

        return createMessage(prompt, { maxTokens: 2048 });
      });

      try {
        finalPlan = JSON.parse(regenResult);
      } catch {
        finalPlan = {
          plan: regenResult,
          tasks: [],
          joyTask: { title: "Приятная прогулка", reasoning: "Время для себя" },
        };
      }

      await ctx.reply(`План на завтра:\n\n${finalPlan.plan}\n\nРадость дня: ${finalPlan.joyTask.title}`, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Принять ✓", callback_data: "plan:accept" },
              { text: "Изменить ✏️", callback_data: "plan:edit" },
            ],
          ],
        },
      });
    }
  }

  // Create tasks for tomorrow
  const allTasks = [
    ...finalPlan.tasks,
    { title: `🌈 ${finalPlan.joyTask.title}`, priority: "medium" as const },
  ];

  await conversation.external(() =>
    createTasksForDate(userId, allTasks, tomorrow, supabase),
  );

  // ── Completion ─────────────────────────────────────────────

  await ctx.reply("Вечерний сканер завершён. Хорошего вечера!");

  ctx.session.step = "idle";
  ctx.session.current_ritual = null;

  // Capture values before async IIFE (ctx may become stale)
  const messageCount = ctx.session.message_count;

  // ── Post-conversation async (fire-and-forget) ─────────────

  void (async () => {
    try {
      if (highlightText) {
        const embedding = await embedText(highlightText, { inputType: "document" });
        await supabase.from("jadlis_documents").insert({
          user_id: userId,
          content: highlightText,
          embedding,
          source_type: "reflection",
          created_at: new Date().toISOString(),
        });
      }

      if (resistanceText) {
        const embedding = await embedText(resistanceText, { inputType: "document" });
        await supabase.from("jadlis_documents").insert({
          user_id: userId,
          content: resistanceText,
          embedding,
          source_type: "energy_leak",
          created_at: new Date().toISOString(),
        });
      }

      // Generate AI summary — reads from Supabase, NOT conversation locals
      const { data: dayData } = await supabase
        .from("days")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .single();

      if (dayData) {
        const summaryPrompt = buildDaySummaryPrompt(dayData);
        const summary = await createMessage(summaryPrompt, { maxTokens: 512 });
        await supabase
          .from("days")
          .update({ ai_summary: summary })
          .eq("user_id", userId)
          .eq("date", today);
      }

      await invalidateWorkingMemoryCache(userId);

      if (shouldTriggerEpisodeSummarization(messageCount)) {
        console.log("[eveningScanner] episode summarization threshold met");
      }
    } catch (err) {
      console.error("[eveningScanner] post-conversation error:", err);
    }
  })();
}
