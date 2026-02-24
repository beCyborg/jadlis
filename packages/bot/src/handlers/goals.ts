import type { SupabaseClient } from "@supabase/supabase-js";

export function createGoalsHandler(supabase: SupabaseClient) {
  return async function handleGoals(ctx: any): Promise<void> {
    const userId = ctx.userId;

    const { data: goals } = await supabase
      .from("goals")
      .select("title, type, progress, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(15);

    if (!goals || goals.length === 0) {
      await ctx.reply("Нет активных целей.");
      return;
    }

    const lines = ["Активные цели:\n"];
    for (const g of goals) {
      const filled = Math.round((g.progress ?? 0) / 10);
      const bar = "\u2588".repeat(filled) + "\u2591".repeat(10 - filled);
      lines.push(`[${g.type}] ${g.title}\n    ${bar} ${g.progress ?? 0}%`);
    }

    await ctx.reply(lines.join("\n"));
  };
}
