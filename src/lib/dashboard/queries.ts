import type { SupabaseClient } from "@supabase/supabase-js";
import { isoToJstYmd, type PeriodRange } from "./date";

export interface DashboardFilter {
  range: PeriodRange;
  /** operator_email で絞り込む。未指定なら全員 */
  operator?: string;
}

export interface DashboardData {
  rangeLabel: string;
  rangeStartYmd: string;
  rangeEndYmd: string;
  todayCallCount: number;
  rangeCallCount: number;
  avgDurationSec: number | null;
  topProducts: { name: string; count: number }[];
  topOperators: { email: string; displayName: string; count: number }[];
  proposalSuccess: { key: string; success: number; proposed: number }[];
  transcriptCount: number;
  displayNamesByEmail: Map<string, string | null>;
  /** 日別受電数 (date は YYYY-MM-DD・JST、range の全日埋め) */
  dailyCalls: { date: string; count: number }[];
  /** 利用可能な operator 一覧（FilterBar の select 用） */
  allOperators: { email: string; displayName: string }[];
}

/**
 * ダッシュボード用データを一括取得する。SSR 内で 1 回呼ぶ前提。
 * filter で期間と operator を指定。operator 指定時は対象期間の recordings
 * から session_id を集めて transcripts/proposals を IN で絞る。
 */
export async function fetchDashboardData(
  supabase: SupabaseClient,
  filter: DashboardFilter
): Promise<DashboardData> {
  const { range, operator } = filter;
  const startIso = range.startIso;
  const endIso = range.endExclusiveIso;

  // 今日の数だけは「期間にかかわらず今日」をその場で算出
  const todayStartIso = (() => {
    const today = isoToJstYmd(new Date().toISOString());
    return new Date(`${today}T00:00:00+09:00`).toISOString();
  })();

  // operator 指定時のセッションID取得（transcripts/proposals 絞り込み用）
  let sessionIds: string[] | null = null;
  if (operator) {
    const sidRes = await supabase
      .from("recordings")
      .select("session_id")
      .eq("operator_email", operator)
      .gte("started_at", startIso)
      .lt("started_at", endIso);
    sessionIds = ((sidRes.data ?? []) as { session_id: string }[]).map(
      (r) => r.session_id
    );
  }

  // 期間内 件数
  const rangeCountBuilder = (() => {
    let q = supabase
      .from("recordings")
      .select("*", { count: "exact", head: true })
      .gte("started_at", startIso)
      .lt("started_at", endIso);
    if (operator) q = q.eq("operator_email", operator);
    return q;
  })();

  // 期間内 通話時間
  const rangeDurationsBuilder = (() => {
    let q = supabase
      .from("recordings")
      .select("duration_sec")
      .not("duration_sec", "is", null)
      .gte("started_at", startIso)
      .lt("started_at", endIso);
    if (operator) q = q.eq("operator_email", operator);
    return q;
  })();

  // 期間内 recordings (operator + 日別集計用)
  const rangeRecordingsBuilder = (() => {
    let q = supabase
      .from("recordings")
      .select("operator_email,started_at")
      .gte("started_at", startIso)
      .lt("started_at", endIso);
    if (operator) q = q.eq("operator_email", operator);
    return q;
  })();

  // transcripts (期間 + 必要なら session_id IN)
  const transcriptsBuilder = (() => {
    let q = supabase
      .from("transcripts")
      .select("products, session_id, created_at")
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    if (sessionIds !== null) {
      q = q.in("session_id", sessionIds.length === 0 ? ["__none__"] : sessionIds);
    }
    return q;
  })();

  // proposals (期間 + 必要なら session_id IN)
  const proposalsBuilder = (() => {
    let q = supabase
      .from("proposals")
      .select("items, session_id, proposed_at")
      .gte("proposed_at", startIso)
      .lt("proposed_at", endIso);
    if (sessionIds !== null) {
      q = q.in("session_id", sessionIds.length === 0 ? ["__none__"] : sessionIds);
    }
    return q;
  })();

  // 並列 fetch
  const [
    todayCountRes,
    rangeCountRes,
    rangeDurationsRes,
    rangeRecordingsRes,
    rangeTranscriptsRes,
    rangeProposalsRes,
    displayNamesRes,
    allOperatorsRes,
  ] = await Promise.all([
    // 今日 (operator フィルタは適用しない＝KPI として全員)
    supabase
      .from("recordings")
      .select("*", { count: "exact", head: true })
      .gte("started_at", todayStartIso),
    rangeCountBuilder,
    rangeDurationsBuilder,
    rangeRecordingsBuilder,
    transcriptsBuilder,
    proposalsBuilder,
    supabase.from("user_roles").select("email,display_name"),
    // operator select 候補（過去 90 日に発信のあった operator）
    supabase
      .from("recordings")
      .select("operator_email")
      .not("operator_email", "is", null)
      .gte(
        "started_at",
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      ),
  ]);

  // 平均通話時間
  const durations = (rangeDurationsRes.data ?? []) as { duration_sec: number }[];
  const avgDurationSec =
    durations.length > 0
      ? Math.round(
          durations.reduce((s, r) => s + r.duration_sec, 0) / durations.length
        )
      : null;

  // 表示名
  const displayNamesByEmail = new Map<string, string | null>();
  for (const u of (displayNamesRes.data ?? []) as {
    email: string;
    display_name: string | null;
  }[]) {
    displayNamesByEmail.set(u.email, u.display_name);
  }

  // 期間内 recordings から: オペレーター集計 + 日別集計
  const operatorCounts = new Map<string, number>();
  const dailyCountMap = new Map<string, number>();
  const tokyoFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (const r of (rangeRecordingsRes.data ?? []) as {
    operator_email: string | null;
    started_at: string;
  }[]) {
    const email = r.operator_email ?? "(unknown)";
    operatorCounts.set(email, (operatorCounts.get(email) ?? 0) + 1);
    if (r.started_at) {
      const ymd = tokyoFmt.format(new Date(r.started_at));
      dailyCountMap.set(ymd, (dailyCountMap.get(ymd) ?? 0) + 1);
    }
  }

  // 日別データ: 期間内の全日を埋める
  const dailyCalls: { date: string; count: number }[] = [];
  const startDt = new Date(range.startIso);
  const endDt = new Date(range.endExclusiveIso);
  for (
    let d = new Date(startDt);
    d < endDt;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const ymd = tokyoFmt.format(d);
    dailyCalls.push({ date: ymd, count: dailyCountMap.get(ymd) ?? 0 });
  }

  const topOperators = [...operatorCounts.entries()]
    .map(([email, count]) => ({
      email,
      displayName: displayNamesByEmail.get(email) ?? email.split("@")[0],
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 商材集計
  const productCounts = new Map<string, number>();
  for (const t of (rangeTranscriptsRes.data ?? []) as {
    products: string[] | null;
  }[]) {
    for (const p of t.products ?? []) {
      if (!p) continue;
      productCounts.set(p, (productCounts.get(p) ?? 0) + 1);
    }
  }
  const topProducts = [...productCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 提案成功集計
  const success = new Map<string, number>();
  const proposed = new Map<string, number>();
  for (const row of (rangeProposalsRes.data ?? []) as {
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
  const proposalSuccess = [
    ...new Set([...success.keys(), ...proposed.keys()]),
  ]
    .map((key) => ({
      key,
      success: success.get(key) ?? 0,
      proposed: proposed.get(key) ?? 0,
    }))
    .sort((a, b) => b.success - a.success)
    .filter((row) => row.proposed > 0);

  // 過去 90 日に発信のあった operator 一覧 (FilterBar 用)
  const allOpEmails = new Set<string>();
  for (const r of (allOperatorsRes.data ?? []) as {
    operator_email: string | null;
  }[]) {
    if (r.operator_email) allOpEmails.add(r.operator_email);
  }
  const allOperators = [...allOpEmails]
    .map((email) => ({
      email,
      displayName: displayNamesByEmail.get(email) ?? email.split("@")[0],
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));

  return {
    rangeLabel: range.label,
    rangeStartYmd: range.startYmd,
    rangeEndYmd: range.endYmd,
    todayCallCount: todayCountRes.count ?? 0,
    rangeCallCount: rangeCountRes.count ?? 0,
    avgDurationSec,
    topProducts,
    topOperators,
    proposalSuccess,
    transcriptCount: (rangeTranscriptsRes.data ?? []).length,
    displayNamesByEmail,
    dailyCalls,
    allOperators,
  };
}

export function formatDurationSec(sec: number | null): string {
  if (sec == null) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
