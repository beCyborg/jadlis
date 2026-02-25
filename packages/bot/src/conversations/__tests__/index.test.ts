import { describe, it, expect, mock } from "bun:test";

// Mock ioredis
mock.module("ioredis", () => ({
  default: mock(() => ({
    disconnect: mock(() => {}),
    connect: mock(() => Promise.resolve()),
    get: mock(() => Promise.resolve(null)),
    set: mock(() => Promise.resolve("OK")),
    del: mock(() => Promise.resolve(1)),
    status: "ready",
  })),
}));

// Track registered middleware
const registeredMiddleware: unknown[] = [];
const registeredCommands: string[] = [];

// Mock grammy Bot
const mockBot = {
  use: mock((mw: unknown) => {
    registeredMiddleware.push(mw);
  }),
  command: mock((cmd: string, _handler: unknown) => {
    registeredCommands.push(cmd);
  }),
};

// Mock @grammyjs/conversations
const mockConversations = mock(() => "conversations-middleware");
const mockCreateConversation = mock((_builder: unknown, opts: { id?: string }) => `conversation-${opts?.id ?? "unnamed"}`);

mock.module("@grammyjs/conversations", () => ({
  conversations: mockConversations,
  createConversation: mockCreateConversation,
}));

const { setupConversations } = await import("../index");

describe("setupConversations", () => {
  it("registers conversations plugin and conversation builders", () => {
    registeredMiddleware.length = 0;
    registeredCommands.length = 0;
    mockBot.use.mockClear();
    mockBot.command.mockClear();

    setupConversations(mockBot as never);

    // conversations middleware + 2 createConversation
    expect(mockBot.use).toHaveBeenCalledTimes(3);
  });

  it("uses Redis storage adapter", () => {
    mockBot.use.mockClear();
    mockConversations.mockClear();

    setupConversations(mockBot as never);

    expect(mockConversations).toHaveBeenCalledTimes(1);
    const opts = mockConversations.mock.calls[0][0];
    expect(opts.storage).toBeDefined();
    expect(opts.storage.type).toBe("key");
    expect(opts.storage.adapter).toBeDefined();
    expect(typeof opts.storage.adapter.read).toBe("function");
    expect(typeof opts.storage.adapter.write).toBe("function");
    expect(typeof opts.storage.adapter.delete).toBe("function");
  });

  it("registers morningCheckin and eveningScanner conversations", () => {
    mockCreateConversation.mockClear();

    setupConversations(mockBot as never);

    expect(mockCreateConversation).toHaveBeenCalledTimes(2);
    const ids = mockCreateConversation.mock.calls.map((c: unknown[]) => (c[1] as { id: string }).id);
    expect(ids).toContain("morningCheckin");
    expect(ids).toContain("eveningScanner");
  });

  it("sets conversation timeout to 1 hour", () => {
    mockCreateConversation.mockClear();

    setupConversations(mockBot as never);

    for (const call of mockCreateConversation.mock.calls) {
      const opts = call[1] as { maxMillisecondsToWait: number };
      expect(opts.maxMillisecondsToWait).toBe(3_600_000);
    }
  });

  it("registers /cancel command", () => {
    mockBot.command.mockClear();

    setupConversations(mockBot as never);

    expect(mockBot.command).toHaveBeenCalledTimes(1);
    expect(mockBot.command.mock.calls[0][0]).toBe("cancel");
  });
});
