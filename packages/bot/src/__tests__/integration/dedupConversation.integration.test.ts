import { describe, test, expect, mock } from "bun:test";
import { dedupGuard } from "../../middleware/dedup";

/**
 * Integration test: Dedup + Conversation interaction
 * Verifies that dedupGuard correctly handles active conversations.
 */

describe("Dedup + Conversation Integration", () => {
  test("dedupGuard does NOT block when conversation is active (processing=false)", async () => {
    const next = mock(() => Promise.resolve());
    const ctx = {
      session: { processing: false },
      reply: mock(() => Promise.resolve()),
    };

    await dedupGuard(ctx as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.session.processing).toBe(false);
  });

  test("dedupGuard DOES block duplicate update when processing=true", async () => {
    const next = mock(() => Promise.resolve());
    const ctx = {
      session: { processing: true },
      reply: mock(() => Promise.resolve()),
    };

    await dedupGuard(ctx as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });

  test("processing flag correctly set and reset through full update lifecycle", async () => {
    const session = { processing: false };

    const next = mock(async () => {
      // During handler execution, processing should be true
      expect(session.processing).toBe(true);
    });

    const ctx = {
      session,
      reply: mock(() => Promise.resolve()),
    };

    await dedupGuard(ctx as never, next);

    // After handler completes, processing should be reset
    expect(session.processing).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("processing flag reset even on handler error", async () => {
    const session = { processing: false };
    const next = mock(() => Promise.reject(new Error("handler crash")));

    const ctx = {
      session,
      reply: mock(() => Promise.resolve()),
    };

    await expect(dedupGuard(ctx as never, next)).rejects.toThrow("handler crash");
    expect(session.processing).toBe(false);
  });
});
