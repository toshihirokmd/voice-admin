import type { SupabaseClient } from "@supabase/supabase-js";
import { jstMonthStartIso, jstTodayStartIso } from "./date";

export interface DashboardData {
  todayCallCount: number;
  monthCallCount: number;
  avgDurationSecMonth: number | null;
  topProductsMonth: { name: string; count: number }[];
  topOperatorsMonth: { email: string; displayName: string; count: number }[];
  proposalSuccessMonth: { key: string; success: number; proposed: number }[];
  transcriptCountMonth: number;
  displayNamesByEmail: Map<string, string | null>;
}

/**
 * ダッシュボード用データを一括取得する。SSR 内で 1 回呼ぶ前提。
 * 各テーブルを並列に query し、JS 側で集計する。
 */
export async function fetchDashboardData(
  supabase: SupabaseClient
): Promise<DashboardData> {
  const todayStart = jstTodayStartIso();
  const monthStart = jstMonthStartIso();

  // 並列 fetch
  const [
    todayCountRes,
    monthCountRes,
    monthDurationsRes,
    monthOperatorsRes,
    monthTranscriptsRes,
    monthProposalsRes,
    displayNamesRes,
  ] = await Promise.all([
    supabase
      .from("recordings")
      .select("*", { count: "exact", head: true })
      .gte("started_at", todayStart),
    supabase
      .from("recordings")
      .select("*", { count: "exact", head: true })
      .gte("started_at", monthStart),
    supabase
      .from("recordings")
      .select("duration_sec")
      .gte("started_at", monthStart)
      .not("duration_sec", "is", null),
    supabase
      .from("recordings")
      .select("operator_email")
      .gte("started_at", monthStart),
    supabase
      .from("transcripts")
      .select("products, created_at")
      .gte("created_at", monthStart),
    supabase
      .from("proposals")
      .select("items, proposed_at")
      .gte("proposed_at", monthStart),
    supabase.from("user_roles").select("email,display_name"),
  ]);

  // 平均通話時間
  const durations = (monthDurationsRes.data ?? []) as { duration_sec: number }[];
  const avgDurationSecMonth =
    durations.length > 0
      ? Math.round(
          durations.reduce((s, r) => s + r.duration_sec, 0) / durations.length
        )
      : null;

  // オペレーター集計 (今月)
  const operatorCounts = new Map<string, number>();
  for (const r of (monthOperatorsRes.data ?? []) as {
    operator_email: string | null;
  }[]) {
    const email = r.operator_email ?? "(unknown)";
    operatorCounts.set(email, (operatorCounts.get(email) ?? 0) + 1);
  }
  const displayNamesByEmail = new Map<string, string | null>();
  for (const u of (displayNamesRes.data ?? []) as {
    email: string;
    display_name: string | null;
  }[]) {
    displayNamesByEmail.set(u.email, u.display_name);
  }
  const topOperatorsMonth = [...operatorCounts.entries()]
    .map(([email, count]) => ({
      email,
      displayName: displayNamesByEmail.get(email) ?? email.split("@")[0],
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 商材集計 (今月)
  const productCounts = new Map<string, number>();
  for (const t of (monthTranscriptsRes.data ?? []) as {
    products: string[] | null;
  }[]) {
    for (const p of t.products ?? []) {
      if (!p) continue;
      productCounts.set(p, (productCounts.get(p) ?? 0) + 1);
    }
  }
  const topProductsMonth = [...productCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 提案成功集計 (今月) — items は { key: "1"|"0"|null } の JSONB
  const success = new Map<string, number>();
  const proposed = new Map<string, number>();
  for (const row of (monthProposalsRes.data ?? []) as {
    items: Record<string, string | null> | null;
  }[]) {
    if (!row.items) continue;
    for (const [key, value] of Object.entries(row.items)) {
      if (value === "1") success.set(key, (success.get(key) ?? 0) + 1);
      if (value === "0" || value === "1") {
        proposed.set(key, (proposed.get(key) ?? 0) + 1);
      }
    }
  }
  const proposalSuccessMonth = [
    ...new Set([...success.keys(), ...proposed.keys()]),
  ]
    .map((key) => ({
      key,
      success: success.get(key) ?? 0,
      proposed: proposed.get(key) ?? 0,
    }))
    .sort((a, b) => b.success - a.success)
    .filter((row) => row.proposed > 0);

  return {
    todayCallCount: todayCountRes.count ?? 0,
    monthCallCount: monthCountRes.count ?? 0,
    avgDurationSecMonth,
    topProductsMonth,
    topOperatorsMonth,
    proposalSuccessMonth,
    transcriptCountMonth: (monthTranscriptsRes.data ?? []).length,
    displayNamesByEmail,
  };
}

export function formatDurationSec(sec: number | null): string {
  if (sec == null) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
