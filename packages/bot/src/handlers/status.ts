import type { SupabaseClient } from "@supabase/supabase-js";

export function createStatusHandler(supabase: SupabaseClient) {
  return async function handleStatus(ctx: any): Promise<void> {
    const userId = ctx.userId;

    const { data: needs } = await supabase
      .from("needs")
      .select("name, current_score")
      .eq("user_id", userId)
      .order("current_score", { ascending: true })
      .limit(5);

    const parts: string[] = ["Текущий статус:\n"];

    if (needs && needs.length > 0) {
      parts.push("Потребности (топ-5 по приоритету):");
      for (const n of needs) {
        parts.push(`  ${n.name}: ${n.current_score ?? 0}/100`);
      }
    } else {
      parts.push("Потребности: нет данных");
    }

    const { data: habits } = await supabase
      .from("habits")
      .select("name, momentum, streak")
      .eq("user_id", userId)
      .limit(10);

    if (habits && habits.length > 0) {
      parts.push("\nПривычки:");
      for (const h of habits) {
        parts.push(`  ${h.name}: momentum ${h.momentum ?? 0}%, streak ${h.streak ?? 0}`);
      }
    }

    const { data: goals } = await supabase
      .from("goals")
      .select("title, progress")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(10);

    if (goals && goals.length > 0) {
      parts.push("\nАктивные цели:");
      for (const g of goals) {
        parts.push(`  ${g.title}: ${g.progress ?? 0}%`);
      }
    }

    await ctx.reply(parts.join("\n"));
  };
}
