import { describe, it, expect, mock, beforeEach } from "bun:test";

// --- Mocks (before dynamic imports) ---

const mockScheduleUserNotifications = mock(() => Promise.resolve());
const mockGetUserSettingsFromRaw = mock((raw: Record<string, unknown> | null) => ({
  timezone: (raw?.timezone as string) ?? "Europe/Moscow",
  morning_neuro_charge_time: (raw?.morning_neuro_charge_time as string) ?? "07:00",
  evening_scanner_time: (raw?.evening_scanner_time as string) ?? "21:00",
  notifications_enabled: true,
}));

mock.module("../../queue/scheduler", () => ({
  scheduleUserNotifications: mockScheduleUserNotifications,
  getUserSettingsFromRaw: mockGetUserSettingsFromRaw,
}));

mock.module("../../db", () => ({ supabase: {} }));

// --- Mock UserRepository ---

const mockFindByTelegramId = mock(() =>
  Promise.resolve({
    id: "user-uuid-123",
    telegram_id: "12345",
    username: "test",
    settings: {},
  }),
);
const mockUpdateSettings = mock(() => Promise.resolve(true));

const mockUserRepo = {
  findByTelegramId: mockFindByTelegramId,
  updateSettings: mockUpdateSettings,
};

// --- Helpers ---

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    reply: mock(() => Promise.resolve()),
    editMessageText: mock(() => Promise.resolve()),
    answerCallbackQuery: mock(() => Promise.resolve()),
    callbackQuery: { data: "" },
    from: { id: 12345 },
    message: { text: "" },
    session: {
      step: "idle",
      current_ritual: null,
      conversation_context: "",
      processing: false,
      working_memory_cache: "",
      working_memory_updated_at: null,
      message_count: 0,
      onboarding_step: undefined as string | undefined,
      onboarding_timezone: undefined as string | undefined,
      onboarding_morning: undefined as string | undefined,
    },
    ...overrides,
  };
}

// --- Tests ---

describe("onboarding handler", () => {
  let startOnboarding: (ctx: ReturnType<typeof makeCtx>) => Promise<void>;
  let handleOnboardingCallback: (ctx: ReturnType<typeof makeCtx>) => Promise<void>;
  let handleOnboardingText: (ctx: ReturnType<typeof makeCtx>, next: () => Promise<void>) => Promise<void>;

  beforeEach(async () => {
    mockScheduleUserNotifications.mockClear();
    mockFindByTelegramId.mockClear();
    mockUpdateSettings.mockClear();

    const mod = await import("../onboarding");
    mod.initOnboarding(mockUserRepo as never);
    startOnboarding = mod.startOnboarding as typeof startOnboarding;
    handleOnboardingText = mod.handleOnboardingText as typeof handleOnboardingText;

    const handlers: Record<string, (ctx: unknown) => Promise<void>> = {};
    const mockBot = {
      callbackQuery: (query: string | RegExp, handler: (ctx: unknown) => Promise<void>) => {
        handlers[String(query)] = handler;
      },
    };
    mod.registerOnboardingHandler(mockBot as never);
    handleOnboardingCallback = handlers["/^onboarding:/"] as typeof handleOnboardingCallback;
  });

  it("onboarding flow triggered after /start sends timezone selection", async () => {
    const ctx = makeCtx();
    await startOnboarding(ctx);

    expect(ctx.session.onboarding_step).toBe("timezone");
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof mock>).mock.calls[0][0] as string;
    expect(msg).toContain("часовой пояс");
  });

  it("timezone selection via inline keyboard advances to morning time", async () => {
    const ctx = makeCtx({
      callbackQuery: { data: "onboarding:tz:Europe/Moscow" },
    });
    await handleOnboardingCallback(ctx);

    expect(ctx.session.onboarding_timezone).toBe("Europe/Moscow");
    expect(ctx.session.onboarding_step).toBe("morning_time");
  });

  it("morning time selection advances to evening time", async () => {
    const ctx = makeCtx({
      callbackQuery: { data: "onboarding:morning:07:00" },
    });
    ctx.session.onboarding_timezone = "Europe/Moscow";
    await handleOnboardingCallback(ctx);

    expect(ctx.session.onboarding_morning).toBe("07:00");
    expect(ctx.session.onboarding_step).toBe("evening_time");
  });

  it("evening time selection completes onboarding and saves settings", async () => {
    const ctx = makeCtx({
      callbackQuery: { data: "onboarding:evening:21:00" },
    });
    ctx.session.onboarding_timezone = "Europe/Moscow";
    ctx.session.onboarding_morning = "07:00";
    await handleOnboardingCallback(ctx);

    expect(ctx.session.onboarding_step).toBe("done");
    expect(mockUpdateSettings).toHaveBeenCalledWith("user-uuid-123", {
      timezone: "Europe/Moscow",
      morning_neuro_charge_time: "07:00",
      evening_scanner_time: "21:00",
      notifications_enabled: true,
    });
  });

  it("scheduleUserNotifications called after onboarding complete", async () => {
    const ctx = makeCtx({
      callbackQuery: { data: "onboarding:evening:21:00" },
    });
    ctx.session.onboarding_timezone = "Europe/Moscow";
    ctx.session.onboarding_morning = "07:00";
    await handleOnboardingCallback(ctx);

    expect(mockScheduleUserNotifications).toHaveBeenCalledWith(12345, 12345, expect.objectContaining({
      timezone: "Europe/Moscow",
      morning_neuro_charge_time: "07:00",
      evening_scanner_time: "21:00",
    }));
  });

  it("without onboarding completion: no notifications scheduled", async () => {
    const ctx = makeCtx({
      callbackQuery: { data: "onboarding:tz:Europe/Moscow" },
    });
    await handleOnboardingCallback(ctx);

    expect(mockScheduleUserNotifications).not.toHaveBeenCalled();
  });

  it("manual timezone input sends prompt", async () => {
    const ctx = makeCtx({
      callbackQuery: { data: "onboarding:tz_manual" },
    });
    await handleOnboardingCallback(ctx);

    expect(ctx.session.onboarding_step).toBe("timezone_manual_input");
  });

  it("valid manual timezone text advances to morning time", async () => {
    const ctx = makeCtx({ message: { text: "Europe/London" } });
    ctx.session.onboarding_step = "timezone_manual_input";
    const next = mock(() => Promise.resolve());
    await handleOnboardingText(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.session.onboarding_timezone).toBe("Europe/London");
    expect(ctx.session.onboarding_step).toBe("morning_time");
  });

  it("invalid manual timezone rejects with message", async () => {
    const ctx = makeCtx({ message: { text: "Invalid/Zone" } });
    ctx.session.onboarding_step = "timezone_manual_input";
    const next = mock(() => Promise.resolve());
    await handleOnboardingText(ctx, next);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof mock>).mock.calls[0][0] as string;
    expect(msg).toContain("Неверный timezone");
  });

  it("handleOnboardingText calls next if not in onboarding", async () => {
    const ctx = makeCtx({ message: { text: "hello" } });
    const next = mock(() => Promise.resolve());
    await handleOnboardingText(ctx, next);

    expect(next).toHaveBeenCalled();
  });
});
