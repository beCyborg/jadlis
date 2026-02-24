import type { SupabaseClient } from "@supabase/supabase-js";

export function createHabitsHandler(supabase: SupabaseClient) {
  return async function handleHabits(ctx: any): Promise<void> {
    const userId = ctx.userId;

    const { data: habits } = await supabase
      .from("habits")
      .select("name, momentum, streak, frequency")
      .eq("user_id", userId)
      .limit(20);

    if (!habits || habits.length === 0) {
      await ctx.reply("Нет привычек.");
      return;
    }

    const lines = ["Привычки:\n"];
    for (const h of habits) {
      lines.push(
        `${h.name} (${h.frequency})\n` +
          `    Momentum: ${h.momentum ?? 0}% | Streak: ${h.streak ?? 0}`,
      );
    }

    await ctx.reply(lines.join("\n"));
  };
}
