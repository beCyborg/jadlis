import { describe, it, expect, mock } from "bun:test";

// Mock ioredis
mock.module("ioredis", () => ({
  default: mock(() => ({
    disconnect: mock(() => {}),
    connect: mock(() => Promise.resolve()),
    status: "ready",
  })),
}));

// Mock bullmq
mock.module("bullmq", () => ({
  Queue: mock(() => ({})),
  Worker: mock(() => ({ on: mock(() => ({})) })),
  UnrecoverableError: class extends Error {},
}));

const { sendRatingKeyboard, sendConfirmKeyboard } = await import("../utils");

describe("sendRatingKeyboard", () => {
  it("generates 1-10 inline keyboard with correct prefix", async () => {
    const mockCtx = {
      reply: mock(() => Promise.resolve()),
    };

    await sendRatingKeyboard(mockCtx as never, "Оцените физическое состояние:", "rating_h01");

    expect(mockCtx.reply).toHaveBeenCalledTimes(1);
    const [text, opts] = mockCtx.reply.mock.calls[0];
    expect(text).toContain("Оцените");

    const keyboard = opts.reply_markup.inline_keyboard;
    expect(keyboard).toHaveLength(2); // 2 rows
    expect(keyboard[0]).toHaveLength(5); // 5 buttons per row
    expect(keyboard[1]).toHaveLength(5);

    // Check callback data
    expect(keyboard[0][0].callback_data).toBe("rating_h01:1");
    expect(keyboard[0][4].callback_data).toBe("rating_h01:5");
    expect(keyboard[1][0].callback_data).toBe("rating_h01:6");
    expect(keyboard[1][4].callback_data).toBe("rating_h01:10");
  });
});

describe("sendConfirmKeyboard", () => {
  it("shows Принять/Изменить/Пропустить buttons", async () => {
    const mockCtx = {
      reply: mock(() => Promise.resolve()),
    };

    await sendConfirmKeyboard(mockCtx as never, "Подтвердите план");

    const [, opts] = mockCtx.reply.mock.calls[0];
    const buttons = opts.reply_markup.inline_keyboard[0];
    expect(buttons).toHaveLength(3);
    expect(buttons[0].callback_data).toBe("confirm:accept");
    expect(buttons[1].callback_data).toBe("confirm:edit");
    expect(buttons[2].callback_data).toBe("confirm:skip");
  });
});
