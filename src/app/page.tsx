import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchDashboardData, formatDurationSec } from "@/lib/dashboard/queries";
import { estimateApiCost } from "@/lib/dashboard/api-cost";
import {
  jstTodayYmd,
  resolvePeriodRange,
  type PeriodPreset,
} from "@/lib/dashboard/date";
import { PROPOSAL_ITEMS } from "@/lib/proposal/items";
import { callTypeLabel, callTypeBadgeClass } from "@/lib/call-type";
import { DailyCallChart } from "./_components/DailyCallChart";
import { FilterBar } from "./_components/FilterBar";

export const dynamic = "force-dynamic";

const PROPOSAL_LABEL_BY_KEY = new Map(
  PROPOSAL_ITEMS.map((p) => [p.key, p.label])
);

const VALID_PRESETS: PeriodPreset[] = [
  "today",
  "yesterday",
  "this_week",
  "this_month",
  "last_month",
  "last_7_days",
  "last_30_days",
  "custom",
];

function parsePreset(raw?: string): PeriodPreset {
  if (raw && (VALID_PRESETS as string[]).includes(raw)) return raw as PeriodPreset;
  return "this_month";
}

interface PageSearchParams {
  period?: string;
  start?: string;
  end?: string;
  operator?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  await requireUser();
  const supabase = createClient();

  const preset = parsePreset(searchParams.period);
  const range = resolvePeriodRange(
    preset,
    searchParams.start,
    searchParams.end
  );
  const operator = searchParams.operator || "";

  const data = await fetchDashboardData(supabase, {
    range,
    operator: operator || undefined,
  });
  const cost = estimateApiCost(
    data.transcriptCount,
    data.avgDurationSec,
    data.totalTokensIn,
    data.totalTokensOut
  );
  const todayYmd = jstTodayYmd();

  // recordings へのリンクで使う共通クエリ
  const filterQs = new URLSearchParams();
  filterQs.set("start_date", data.rangeStartYmd);
  filterQs.set("end_date", data.rangeEndYmd);
  if (operator) filterQs.set("operator", operator);
  const recordingsBaseQs = filterQs.toString();

  const operatorDisplayName = operator
    ? data.allOperators.find((o) => o.email === operator)?.displayName ??
      operator.split("@")[0]
    : null;

  return (
    <section className="space-y-6">
      <header>
        <div className="text-xs font-bold text-brand-leaf tracking-widest">
          DASHBOARD
        </div>
        <h1 className="text-3xl font-extrabold text-brand-green">
          ダッシュボード
        </h1>
        <div className="mt-1 h-1 w-12 rounded-full bg-brand-sakura" />
        <p className="text-xs text-brand-sub mt-2">
          {data.rangeLabel} ({data.rangeStartYmd}
          {data.rangeStartYmd !== data.rangeEndYmd && ` 〜 ${data.rangeEndYmd}`})
          {operatorDisplayName && ` / 担当: ${operatorDisplayName}`}
          {" "}— 各カードをクリックで該当の録音一覧に遷移
        </p>
      </header>

      <FilterBar
        operators={data.allOperators}
        currentPreset={preset}
        currentOperator={operator}
        currentStartYmd={data.rangeStartYmd}
        currentEndYmd={data.rangeEndYmd}
      />

      {/* KPI cards：主役の「今日の受電」だけ深緑ヒーロー、他は白＋アイコンチップ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <Link
          href={`/recordings?start_date=${todayYmd}&end_date=${todayYmd}`}
          className="group rounded-card p-5 shadow-softlg bg-gradient-to-br from-brand-green to-brand-dark text-white hover:-translate-y-0.5 transition"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-white/80 tracking-wider">
              今日の受電
            </div>
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/15 text-base">
              📞
            </span>
          </div>
          <div className="text-5xl font-extrabold mt-2 tabular-nums leading-none">
            {data.todayCallCount}
          </div>
          <div className="text-xs text-white/75 mt-2">
            <span className="px-1.5 py-0.5 rounded-full bg-white/15 font-bold">
              {todayYmd}
            </span>
          </div>
        </Link>

        <Link
          href={`/recordings?${recordingsBaseQs}`}
          className="group bg-white border border-brand-border rounded-card p-5 shadow-soft hover:shadow-softlg hover:-translate-y-0.5 transition"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-brand-sub tracking-wider">
              期間内 受電
            </div>
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-brand-green text-base">
              📈
            </span>
          </div>
          <div className="text-4xl font-extrabold text-brand-green mt-2 tabular-nums leading-none">
            {data.rangeCallCount}
          </div>
          <div className="text-xs text-brand-sub mt-2">{data.rangeLabel}</div>
        </Link>

        <div className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-brand-sub tracking-wider">
              平均通話時間
            </div>
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-brand-green text-base">
              ⏱️
            </span>
          </div>
          <div className="text-4xl font-extrabold text-brand-green mt-2 tabular-nums leading-none">
            {formatDurationSec(data.avgDurationSec)}
          </div>
          <div className="text-xs text-brand-sub mt-2">m:ss</div>
        </div>

        <div
          className="bg-white border border-brand-border rounded-card p-5 shadow-soft"
          title={`Gemini: $${cost.geminiUsd} (入力$${cost.geminiInputUsd} + 出力$${cost.geminiOutputUsd})\nCloud Run: $${cost.cloudRunUsd} (月額固定$8 + 通話あたり$0.002)\nSupabase: $${cost.supabaseUsd} (月額固定)\nTokens: in ${cost.tokensIn.toLocaleString()} / out ${cost.tokensOut.toLocaleString()}`}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-brand-sub tracking-wider">
              API 費用 {cost.source === "actual" ? "(実費)" : "(概算)"}
            </div>
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-ssoft text-brand-sakura text-base">
              💰
            </span>
          </div>
          <div className="text-3xl font-extrabold text-brand-green mt-2 tabular-nums leading-none">
            ¥{cost.totalJpy.toLocaleString()}
          </div>
          <div className="text-[10px] text-brand-sub mt-2 leading-tight space-y-0.5">
            <div>
              Gemini ${cost.geminiUsd}（{data.transcriptCount}件 /{" "}
              {(cost.tokensIn / 1000).toFixed(0)}k+
              {(cost.tokensOut / 1000).toFixed(0)}k tokens）
            </div>
            <div>
              Run ${cost.cloudRunUsd} / Supabase ${cost.supabaseUsd}
              <span className="opacity-70">（月額固定）</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily call trend chart */}
      <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
            📊
          </span>
          <h2 className="font-bold text-brand-green">日別の受電数</h2>
          <span className="ml-auto text-xs text-brand-sub">
            棒をクリックでその日の録音一覧
          </span>
        </div>
        <DailyCallChart
          data={data.dailyCalls}
          operatorParam={operator || null}
        />
      </section>

      {/* Call type breakdown */}
      {data.callTypeBreakdown.length > 0 && (
        <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
              🗂️
            </span>
            <h2 className="font-bold text-brand-green">通話種別の内訳</h2>
          </div>
          {(() => {
            const total = data.callTypeBreakdown.reduce(
              (s, c) => s + c.count,
              0
            );
            return (
              <div className="space-y-4">
                {data.callTypeBreakdown.map((c, idx) => {
                  const pct = total > 0 ? (c.count / total) * 100 : 0;
                  return (
                    <div key={c.type}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${callTypeBadgeClass(c.type)}`}
                        >
                          {callTypeLabel(c.type)}
                        </span>
                        <span className="font-mono text-brand-ink">
                          {c.count} 件
                          <span className="text-brand-sub text-xs ml-1">
                            ({pct.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2.5 bg-brand-soft rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${idx === 0 ? "bg-brand-green" : "bg-brand-leaf"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </section>
      )}

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top operators */}
        <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
              🏆
            </span>
            <h2 className="font-bold text-brand-green">
              受電トップオペレーター
            </h2>
          </div>
          {data.topOperators.length === 0 ? (
            <p className="text-sm text-brand-sub">データなし</p>
          ) : (
            <ol className="space-y-3.5">
              {(() => {
                const max = Math.max(
                  1,
                  ...data.topOperators.map((o) => o.count)
                );
                return data.topOperators.map((op, idx) => {
                  const pct = (op.count / max) * 100;
                  const isActive = op.email === operator;
                  const isTop = idx === 0;
                  return (
                    <li key={op.email}>
                      <Link
                        href={`/recordings?${new URLSearchParams({
                          operator: op.email,
                          start_date: data.rangeStartYmd,
                          end_date: data.rangeEndYmd,
                        }).toString()}`}
                        className={`block rounded-lg px-2 py-1 -mx-2 transition ${
                          isActive
                            ? "bg-brand-soft ring-1 ring-brand-leaf/40"
                            : "hover:bg-brand-soft/50"
                        }`}
                      >
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-extrabold ${
                                isTop
                                  ? "bg-brand-green text-white"
                                  : "bg-brand-leaf/25 text-brand-green"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span
                              className={`truncate ${isTop ? "font-bold" : ""}`}
                              title={op.email}
                            >
                              {op.displayName}
                            </span>
                          </span>
                          <span
                            className={`font-mono ml-2 ${isTop ? "text-brand-green font-bold" : "text-brand-ink"}`}
                          >
                            {op.count} 件
                          </span>
                        </div>
                        <div className="h-2 bg-brand-soft rounded-full ml-7 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isTop ? "bg-brand-green" : "bg-brand-leaf"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </Link>
                    </li>
                  );
                });
              })()}
            </ol>
          )}
        </section>

        {/* Top products */}
        <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
              🌿
            </span>
            <h2 className="font-bold text-brand-green">受電が多い商材</h2>
          </div>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-brand-sub">データなし</p>
          ) : (
            <ol className="space-y-3.5">
              {(() => {
                const max = Math.max(1, ...data.topProducts.map((p) => p.count));
                return data.topProducts.map((p, idx) => {
                  const pct = (p.count / max) * 100;
                  const isTop = idx === 0;
                  return (
                    <li key={p.name}>
                      <Link
                        href={`/recordings?${new URLSearchParams({
                          product: p.name,
                          start_date: data.rangeStartYmd,
                          end_date: data.rangeEndYmd,
                          ...(operator ? { operator } : {}),
                        }).toString()}`}
                        className="block hover:bg-brand-soft/50 rounded-lg px-2 py-1 -mx-2"
                      >
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-extrabold ${
                                isTop
                                  ? "bg-brand-green text-white"
                                  : "bg-brand-leaf/25 text-brand-green"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span
                              className={`truncate ${isTop ? "font-bold" : ""}`}
                              title={p.name}
                            >
                              {p.name}
                            </span>
                          </span>
                          <span
                            className={`font-mono ml-2 ${isTop ? "text-brand-green font-bold" : "text-brand-ink"}`}
                          >
                            {p.count} 件
                          </span>
                        </div>
                        <div className="h-2 bg-brand-soft rounded-full ml-7 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isTop ? "bg-brand-green" : "bg-brand-leaf"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </Link>
                    </li>
                  );
                });
              })()}
            </ol>
          )}
        </section>
      </div>

      {/* Proposal success ranking */}
      <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
            🎯
          </span>
          <h2 className="font-bold text-brand-green">提案成功ランキング</h2>
        </div>
        {data.proposalSuccess.length === 0 ? (
          <p className="text-sm text-brand-sub">データなし</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-brand-sub bg-brand-soft">
                <th className="py-2 px-3 rounded-l-lg">項目</th>
                <th className="py-2 px-3 text-right">成功</th>
                <th className="py-2 px-3 text-right">提案数</th>
                <th className="py-2 px-3 w-48">成功率</th>
                <th className="py-2 px-3 text-right rounded-r-lg">率</th>
              </tr>
            </thead>
            <tbody>
              {data.proposalSuccess.map((row) => {
                const rate =
                  row.proposed > 0 ? (row.success / row.proposed) * 100 : 0;
                const rateColor =
                  rate >= 50
                    ? "bg-brand-green"
                    : rate >= 25
                    ? "bg-brand-leaf"
                    : "bg-brand-sakura";
                return (
                  <tr
                    key={row.key}
                    className="border-b border-brand-border last:border-b-0"
                  >
                    <td className="py-3.5 px-3">
                      <Link
                        href={`/recordings?${new URLSearchParams({
                          success: row.key,
                          start_date: data.rangeStartYmd,
                          end_date: data.rangeEndYmd,
                          ...(operator ? { operator } : {}),
                        }).toString()}`}
                        className="text-brand-green hover:underline"
                      >
                        {PROPOSAL_LABEL_BY_KEY.get(row.key) ?? row.key}
                      </Link>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-brand-green font-bold">
                      {row.success}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-brand-sub">
                      {row.proposed}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="h-2 bg-brand-soft rounded-full overflow-hidden">
                        <div
                          className={`h-full ${rateColor} rounded-full`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono">
                      {rate.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <div className="text-center mt-6">
        <Link
          href={`/recordings?${recordingsBaseQs}`}
          className="inline-block bg-brand-green text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-dark hover:-translate-y-0.5 transition shadow-soft"
        >
          全録音一覧を見る（このフィルタを引き継ぐ）
        </Link>
      </div>
    </section>
  );
}
