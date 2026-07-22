import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchDashboardData,
  type DashboardData,
} from "@/lib/dashboard/queries";
import { resolvePeriodRange, type PeriodRange } from "@/lib/dashboard/date";

export interface GlobalAverages {
  /** 全 operator・全通話の平均通話時間 (秒) */
  avgDurationSec: number | null;
  /** 全通話数 / アクティブ operator 数 */
  avgCallsPerOperator: number;
  /** 提案項目ごとの全体成功率 (key → 0-100) */
  proposalSuccessRate: Map<string, number>;
  /** アクティブ operator 数（参考） */
  activeOperatorCount: number;
}

export interface MeData {
  me: DashboardData;
  prev: DashboardData;
  global: GlobalAverages;
  prevRange: PeriodRange;
}

/**
 * マイページ用の集計データを一括取得する。
 * - me: 今月の自分のデータ（fetchDashboardData を operator フィルタで再利用）
 * - prev: 先月の自分のデータ（同上、前月 preset）
 * - global: 全体平均（個人 vs 全体比較用）
 */
export async function fetchMeData(
  supabase: SupabaseClient,
  email: string,
  range: PeriodRange
): Promise<MeData> {
  const prevRange = resolvePeriodRange("last_month");
  const [me, prev, global] = await Promise.all([
    fetchDashboardData(supabase, { range, operator: email }),
    fetchDashboardData(supabase, { range: prevRange, operator: email }),
    fetchGlobalAverages(supabase, range),
  ]);
  return { me, prev, global, prevRange };
}

/**
 * 全体平均（自分の数字との比較ベースライン用）。軽い 3 query。
 */
export async function fetchGlobalAverages(
  supabase: SupabaseClient,
  range: PeriodRange
): Promise<GlobalAverages> {
  const startIso = range.startIso;
  const endIso = range.endExclusiveIso;

  const [durRes, opRes, propRes] = await Promise.all([
    supabase
      .from("recordings")
      .select("duration_sec")
      .gte("started_at", startIso)
      .lt("started_at", endIso)
      .not("duration_sec", "is", null),
    supabase
      .from("recordings")
      .select("operator_email")
      .gte("started_at", startIso)
      .lt("started_at", endIso)
      .not("operator_email", "is", null),
    supabase
      .from("proposals")
      .select("items")
      .gte("proposed_at", startIso)
      .lt("proposed_at", endIso),
  ]);

  // 平均通話時間
  const durations = (durRes.data ?? []) as { duration_sec: number }[];
  const avgDurationSec =
    durations.length > 0
      ? Math.round(
          durations.reduce((s, r) => s + r.duration_sec, 0) / durations.length
        )
      : null;

  // 平均通話数 / オペレーター
  const operatorCalls = new Map<string, number>();
  for (const r of (opRes.data ?? []) as { operator_email: string }[]) {
    operatorCalls.set(r.operator_email, (operatorCalls.get(r.operator_email) ?? 0) + 1);
  }
  const totalCalls = [...operatorCalls.values()].reduce((s, n) => s + n, 0);
  const activeOperatorCount = operatorCalls.size;
  const avgCallsPerOperator =
    activeOperatorCount > 0 ? Math.round(totalCalls / activeOperatorCount) : 0;

  // 提案成功率（項目別）
  const success = new Map<string, number>();
  const proposed = new Map<string, number>();
  for (const row of (propRes.data ?? []) as {
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
  const proposalSuccessRate = new Map<string, number>();
  for (const key of new Set([...success.keys(), ...proposed.keys()])) {
    const s = success.get(key) ?? 0;
    const p = proposed.get(key) ?? 0;
    if (p > 0) proposalSuccessRate.set(key, (s / p) * 100);
  }

  return {
    avgDurationSec,
    avgCallsPerOperator,
    proposalSuccessRate,
    activeOperatorCount,
  };
}

/** 提案成功率の全体平均（全項目を加重平均） */
export function calcOverallProposalRate(
  successByKey: Map<string, { success: number; proposed: number }>
): number | null {
  let totalSuccess = 0;
  let totalProposed = 0;
  for (const { success, proposed } of successByKey.values()) {
    totalSuccess += success;
    totalProposed += proposed;
  }
  return totalProposed > 0 ? (totalSuccess / totalProposed) * 100 : null;
}

/** DashboardData の proposalSuccess を Map に変換 */
export function proposalSuccessMap(
  data: DashboardData
): Map<string, { success: number; proposed: number }> {
  const m = new Map<string, { success: number; proposed: number }>();
  for (const r of data.proposalSuccess) {
    m.set(r.key, { success: r.success, proposed: r.proposed });
  }
  return m;
}

export interface MyCall {
  id: string;
  sessionId: string;
  startedAt: string | null;
  durationSec: number | null;
  status: string;
  title: string | null;
  summary: string | null;
  mergedText: string | null;
}

/**
 * ログイン中オペレーター自身の通話を新しい順に取得する。
 * 自分の対応を振り返る用途なので operator_email で必ず絞る（他人の通話は返さない）。
 * 拡張で録った通常の通話のみ（アップロード分は /uploads で見る）。
 */
export async function fetchMyCalls(
  supabase: SupabaseClient,
  email: string,
  limit = 50
): Promise<MyCall[]> {
  const { data } = await supabase
    .from("recordings")
    .select("id, session_id, started_at, duration_sec, status, source, transcripts(title, summary, merged_text)")
    .eq("operator_email", email)
    .neq("source", "upload")
    .order("started_at", { ascending: false })
    .limit(limit);

  type Row = {
    id: string;
    session_id: string;
    started_at: string | null;
    duration_sec: number | null;
    status: string;
    transcripts: { title: string | null; summary: string | null; merged_text: string | null }[] | null;
  };

  return ((data ?? []) as Row[]).map((r) => {
    const t = r.transcripts?.[0];
    return {
      id: r.id,
      sessionId: r.session_id,
      startedAt: r.started_at,
      durationSec: r.duration_sec,
      status: r.status,
      title: t?.title ?? null,
      summary: t?.summary ?? null,
      mergedText: t?.merged_text ?? null,
    };
  });
}
