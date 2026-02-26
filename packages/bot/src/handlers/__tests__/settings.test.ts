import { describe, it, expect, mock, beforeEach } from "bun:test";

// --- Mocks (before dynamic imports) ---

const mockScheduleUserNotifications = mock(() => Promise.resolve());
const mockCancelUserNotifications = mock(() => Promise.resolve());
const mockGetUserSettingsFromRaw = mock((raw: Record<string, unknown> | null) => ({
  timezone: (raw?.timezone as string) ?? "Europe/Moscow",
  morning_neuro_charge_time: (raw?.morning_neuro_charge_time as string) ?? "07:00",
  evening_scanner_time: (raw?.evening_scanner_time as string) ?? "21:00",
  notifications_enabled: raw?.notifications_enabled !== false,
}));

mock.module("../../queue/scheduler", () => ({
  scheduleUserNotifications: mockScheduleUserNotifications,
  cancelUserNotifications: mockCancelUserNotifications,
  getUserSettingsFromRaw: mockGetUserSettingsFromRaw,
}));

mock.module("../../db", () => ({ supabase: {} }));

// --- Mock UserRepository ---

const mockFindById = mock(() =>
  Promise.resolve({
    id: "user-uuid-123",
    telegram_id: "12345",
    username: "test",
    settings: {},
  }),
);
const mockMergeSettings = mock(() =>
  Promise.resolve({ timezone: "Europe/Moscow" }),
);
const mockUpdateSettings = mock(() => Promise.resolve(true));

const mockUserRepo = {
  findById: mockFindById,
  mergeSettings: mockMergeSettings,
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
    userId: "user-uuid-123",
    session: { settings_awaiting_tz: false },
    ...overrides,
  };
}

// --- Tests ---

describe("settings handler", () => {
  let handleCommand: (ctx: ReturnType<typeof makeCtx>) => Promise<void>;
  let handleCallback: (ctx: ReturnType<typeof makeCtx>) => Promise<void>;
  let handleText: (ctx: ReturnType<typeof makeCtx>, next: () => Promise<void>) => Promise<void>;

  beforeEach(async () => {
    mockScheduleUserNotifications.mockClear();
    mockCancelUserNotifications.mockClear();
    mockFindById.mockClear();
    mockMergeSettings.mockClear();
    mockFindById.mockImplementation(() =>
      Promise.resolve({
        id: "user-uuid-123",
        telegram_id: "12345",
        username: "test",
        settings: {},
      }),
    );
    mockMergeSettings.mockImplementation(() =>
      Promise.resolve({ timezone: "Europe/Moscow" }),
    );

    const mod = await import("../settings");
    mod.initSettings(mockUserRepo as never);

    const handlers: Record<string, (ctx: unknown) => Promise<void>> = {};
    const commands: Record<string, (ctx: unknown) => Promise<void>> = {};
    const mockBot = {
      command: (name: string, handler: (ctx: unknown) => Promise<void>) => {
        commands[name] = handler;
      },
      callbackQuery: (query: string | RegExp, handler: (ctx: unknown) => Promise<void>) => {
        handlers[String(query)] = handler;
      },
    };
    mod.registerSettingsHandler(mockBot as never);
    handleCommand = commands["settings"] as typeof handleCommand;
    handleCallback = handlers["/^settings:/"] as typeof handleCallback;
    handleText = mod.handleSettingsText as typeof handleText;
  });

  it("/settings displays current user settings", async () => {
    const ctx = makeCtx();
    await handleCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const msg = (ctx.reply as ReturnType<typeof mock>).mock.calls[0][0] as string;
    expect(msg).toContain("Настройки уведомлений:");
  });

  it("settings:morning shows time options", async () => {
    const ctx = makeCtx({ callbackQuery: { data: "settings:morning" } });
    await handleCallback(ctx);

    expect(ctx.editMessageText).toHaveBeenCalledTimes(1);
    const msg = (ctx.editMessageText as ReturnType<typeof mock>).mock.calls[0][0] as string;
    expect(msg).toContain("Время утреннего ритуала");
  });

  it("settings update triggers scheduleUserNotifications", async () => {
    mockMergeSettings.mockImplementation(() =>
      Promise.resolve({ morning_neuro_charge_time: "08:00" }),
    );

    const ctx = makeCtx({ callbackQuery: { data: "settings:morning:08:00" } });
    await handleCallback(ctx);

    expect(mockMergeSettings).toHaveBeenCalledWith("user-uuid-123", {
      morning_neuro_charge_time: "08:00",
    });
    expect(mockScheduleUserNotifications).toHaveBeenCalled();
  });

  it("timezone change passes correct IANA string to scheduler", async () => {
    mockMergeSettings.mockImplementation(() =>
      Promise.resolve({ timezone: "Asia/Tokyo" }),
    );

    const ctx = makeCtx({ callbackQuery: { data: "settings:timezone:Asia/Tokyo" } });
    await handleCallback(ctx);

    expect(mockScheduleUserNotifications).toHaveBeenCalled();
    const callArgs = mockScheduleUserNotifications.mock.calls[0];
    expect(callArgs[2]).toEqual(
      expect.objectContaining({ timezone: "Asia/Tokyo" }),
    );
  });

  it("settings:tz_manual sets session flag", async () => {
    const ctx = makeCtx({ callbackQuery: { data: "settings:tz_manual" } });
    await handleCallback(ctx);

    expect(ctx.session.settings_awaiting_tz).toBe(true);
  });

  it("handleSettingsText processes valid timezone", async () => {
    mockMergeSettings.mockImplementation(() =>
      Promise.resolve({ timezone: "Europe/London" }),
    );

    const ctx = makeCtx({
      message: { text: "Europe/London" },
      session: { settings_awaiting_tz: true },
    });
    const next = mock(() => Promise.resolve());
    await handleText(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.session.settings_awaiting_tz).toBe(false);
    expect(mockScheduleUserNotifications).toHaveBeenCalled();
  });

  it("handleSettingsText calls next if not awaiting tz", async () => {
    const ctx = makeCtx({
      message: { text: "hello" },
      session: { settings_awaiting_tz: false },
    });
    const next = mock(() => Promise.resolve());
    await handleText(ctx, next);

    expect(next).toHaveBeenCalled();
  });

  it("toggle notifications off cancels user notifications", async () => {
    const ctx = makeCtx({
      callbackQuery: { data: "settings:toggle_notifications" },
    });
    await handleCallback(ctx);

    expect(mockCancelUserNotifications).toHaveBeenCalledWith(12345);
  });
});
