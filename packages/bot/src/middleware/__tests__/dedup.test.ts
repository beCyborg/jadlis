import { describe, it, expect, mock } from "bun:test";
import { dedupGuard } from "../dedup";

describe("dedupGuard", () => {
  it("blocks duplicate updates when processing is true", async () => {
    const next = mock(() => Promise.resolve());
    const ctx = {
      session: { processing: true },
      reply: mock(() => Promise.resolve()),
    };

    await dedupGuard(ctx as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledTimes(1);
  });

  it("sets processing flag and resets after next()", async () => {
    const next = mock(() => Promise.resolve());
    const session = { processing: false };
    const ctx = {
      session,
      reply: mock(() => Promise.resolve()),
    };

    await dedupGuard(ctx as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(session.processing).toBe(false);
  });

  it("resets processing flag even if next() throws", async () => {
    const next = mock(() => Promise.reject(new Error("test")));
    const session = { processing: false };
    const ctx = {
      session,
      reply: mock(() => Promise.resolve()),
    };

    await expect(dedupGuard(ctx as never, next)).rejects.toThrow("test");
    expect(session.processing).toBe(false);
  });
});
