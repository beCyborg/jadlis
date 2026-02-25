import type { Conversation } from "@grammyjs/conversations";
import type { BotContext } from "../bot";

const MAX_MULTISELECT_ITEMS = 10;

/**
 * Sends a 1-10 rating keyboard as an inline keyboard message.
 * Two rows of 5 buttons each.
 */
export async function sendRatingKeyboard(
  ctx: BotContext,
  question: string,
  prefix: string,
): Promise<void> {
  const row1 = Array.from({ length: 5 }, (_, i) => ({
    text: String(i + 1),
    callback_data: `${prefix}:${i + 1}`,
  }));
  const row2 = Array.from({ length: 5 }, (_, i) => ({
    text: String(i + 6),
    callback_data: `${prefix}:${i + 6}`,
  }));

  await ctx.reply(question, {
    reply_markup: { inline_keyboard: [row1, row2] },
  });
}

/**
 * Waits for a rating callback query and returns the numeric value 1-10.
 * Answers the callback query automatically.
 */
export async function waitForRating(
  conversation: Conversation<BotContext>,
  prefix: string,
): Promise<number> {
  const ctx = await conversation.waitForCallbackQuery(
    new RegExp(`^${prefix}:([1-9]|10)$`),
    {
      otherwise: (ctx) =>
        ctx.reply("Пожалуйста, выберите оценку от 1 до 10."),
    },
  );
  await ctx.answerCallbackQuery();
  const value = Number(ctx.callbackQuery.data.split(":")[1]);
  return value;
}

/**
 * Sends a confirm keyboard with 3 options: Принять / Изменить / Пропустить.
 */
export async function sendConfirmKeyboard(
  ctx: BotContext,
  message: string,
): Promise<void> {
  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Принять ✓", callback_data: "confirm:accept" },
          { text: "Изменить ✏️", callback_data: "confirm:edit" },
          { text: "Пропустить →", callback_data: "confirm:skip" },
        ],
      ],
    },
  });
}

/**
 * Multi-select keyboard interaction.
 * Returns array of selected item IDs after user presses Готово.
 * Caps at 10 items displayed.
 */
export async function sendMultiSelectKeyboard(
  conversation: Conversation<BotContext>,
  ctx: BotContext,
  items: Array<{ id: string; label: string }>,
  prefix: string,
): Promise<string[]> {
  const selected = new Set<string>();
  const displayItems = items.slice(0, MAX_MULTISELECT_ITEMS);
  const overflow = items.length - displayItems.length;

  function buildKeyboard() {
    const rows = displayItems.map((item) => [
      {
        text: `${selected.has(item.id) ? "☑" : "◻"} ${item.label}`,
        callback_data: `${prefix}:toggle:${item.id}`,
      },
    ]);
    rows.push([{ text: "Готово ✓", callback_data: `${prefix}:done` }]);
    return { inline_keyboard: rows };
  }

  let overflowText = "";
  if (overflow > 0) {
    overflowText = `\n\n_и ещё ${overflow} задач (используйте /status для полного списка)_`;
  }

  await ctx.reply(`Выберите из списка:${overflowText}`, {
    reply_markup: buildKeyboard(),
    parse_mode: "Markdown",
  });

  while (true) {
    const cbCtx = await conversation.waitForCallbackQuery(
      new RegExp(`^${prefix}:(toggle|done)`),
      {
        otherwise: (ctx) =>
          ctx.reply("Используйте кнопки для выбора."),
      },
    );

    const data = cbCtx.callbackQuery.data;
    await cbCtx.answerCallbackQuery();

    if (data === `${prefix}:done`) {
      return Array.from(selected);
    }

    // Toggle
    const itemId = data.replace(`${prefix}:toggle:`, "");
    if (selected.has(itemId)) {
      selected.delete(itemId);
    } else {
      selected.add(itemId);
    }

    // Update keyboard
    await cbCtx.editMessageReplyMarkup({
      reply_markup: buildKeyboard(),
    });
  }
}
