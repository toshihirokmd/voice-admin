import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchDashboardData, formatDurationSec } from "@/lib/dashboard/queries";
import { estimateApiCost } from "@/lib/dashboard/api-cost";
import {
  jstTodayYmd,
  resolvePeriodRange,
  type PeriodPreset,
} from "@/lib/dashboard/date";
import { PROPOSAL_ITEMS } from "@/lib/proposal/items";
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
  await requireAdmin();
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
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-xs text-gray-500 mt-1">
          {data.rangeLabel} ({data.rangeStartYmd}
          {data.rangeStartYmd !== data.rangeEndYmd && ` 〜 ${data.rangeEndYmd}`})
          {operatorDisplayName && ` / 担当: ${operatorDisplayName}`}
          {" "}— 各セクションをクリックで該当の録音一覧に遷移
        </p>
      </header>

      <FilterBar
        operators={data.allOperators}
        currentPreset={preset}
        currentOperator={operator}
        currentStartYmd={data.rangeStartYmd}
        currentEndYmd={data.rangeEndYmd}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href={`/recordings?start_date=${todayYmd}&end_date=${todayYmd}`}
          className="group bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 hover:shadow-md hover:from-blue-100 hover:to-blue-200 transition"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              今日の受電
            </div>
            <div className="w-2 h-2 rounded-full bg-blue-400 group-hover:bg-blue-600 transition" />
          </div>
          <div className="text-4xl font-bold text-blue-900 mt-2 tabular-nums">
            {data.todayCallCount}
          </div>
          <div className="text-xs text-blue-600/70 mt-1">({todayYmd})</div>
        </Link>

        <Link
          href={`/recordings?${recordingsBaseQs}`}
          className="group bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200 rounded-xl p-4 hover:shadow-md hover:from-violet-100 hover:to-violet-200 transition"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-violet-700 uppercase tracking-wider">
              期間内 受電
            </div>
            <div className="w-2 h-2 rounded-full bg-violet-400 group-hover:bg-violet-600 transition" />
          </div>
          <div className="text-4xl font-bold text-violet-900 mt-2 tabular-nums">
            {data.rangeCallCount}
          </div>
          <div className="text-xs text-violet-600/70 mt-1">
            {data.rangeLabel}
          </div>
        </Link>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              平均通話時間
            </div>
            <div className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="text-4xl font-bold text-amber-900 mt-2 tabular-nums">
            {formatDurationSec(data.avgDurationSec)}
          </div>
          <div className="text-xs text-amber-600/70 mt-1">m:ss</div>
        </div>

        <div
          className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4"
          title={`Gemini: $${cost.geminiUsd} (入力$${cost.geminiInputUsd} + 出力$${cost.geminiOutputUsd})\nCloud Run: $${cost.cloudRunUsd} (月額固定$8 + 通話あたり$0.002)\nSupabase: $${cost.supabaseUsd} (月額固定)\nTokens: in ${cost.tokensIn.toLocaleString()} / out ${cost.tokensOut.toLocaleString()}`}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              API 費用 {cost.source === "actual" ? "(実費)" : "(概算)"}
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-900 mt-2 tabular-nums">
            ¥{cost.totalJpy.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-700/70 mt-1 leading-tight space-y-0.5">
            <div>
              Gemini ${cost.geminiUsd}（{data.transcriptCount}件 /{" "}
              {(cost.tokensIn / 1000).toFixed(0)}k+
              {(cost.tokensOut / 1000).toFixed(0)}k tokens）
            </div>
            <div>
              Run ${cost.cloudRunUsd} / Supabase ${cost.supabaseUsd}
              <span className="text-emerald-600/60">（月額固定）</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily call trend chart */}
      <section className="bg-white border rounded-lg p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">日別受電数</h2>
          <span className="text-xs text-gray-400">
            棒をクリックでその日の録音一覧
          </span>
        </div>
        <DailyCallChart
          data={data.dailyCalls}
          operatorParam={operator || null}
        />
      </section>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top operators */}
        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3">受電トップオペレーター</h2>
          {data.topOperators.length === 0 ? (
            <p className="text-sm text-gray-400">データなし</p>
          ) : (
            <ol className="space-y-2">
              {(() => {
                const max = Math.max(
                  1,
                  ...data.topOperators.map((o) => o.count)
                );
                return data.topOperators.map((op, idx) => {
                  const pct = (op.count / max) * 100;
                  const isActive = op.email === operator;
                  return (
                    <li key={op.email}>
                      <Link
                        href={`/recordings?${new URLSearchParams({
                          operator: op.email,
                          start_date: data.rangeStartYmd,
                          end_date: data.rangeEndYmd,
                        }).toString()}`}
                        className={`block rounded px-2 py-1 -mx-2 transition ${
                          isActive
                            ? "bg-blue-50 ring-1 ring-blue-200"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-gray-400 w-6 text-right">
                              {idx + 1}.
                            </span>
                            <span className="truncate" title={op.email}>
                              {op.displayName}
                            </span>
                          </span>
                          <span className="font-mono text-gray-700 ml-2">
                            {op.count} 件
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded ml-8 overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded"
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
        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3">受電が多い商材</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-gray-400">データなし</p>
          ) : (
            <ol className="space-y-2">
              {(() => {
                const max = Math.max(1, ...data.topProducts.map((p) => p.count));
                return data.topProducts.map((p, idx) => {
                  const pct = (p.count / max) * 100;
                  return (
                    <li key={p.name}>
                      <Link
                        href={`/recordings?${new URLSearchParams({
                          product: p.name,
                          start_date: data.rangeStartYmd,
                          end_date: data.rangeEndYmd,
                          ...(operator ? { operator } : {}),
                        }).toString()}`}
                        className="block hover:bg-gray-50 rounded px-2 py-1 -mx-2"
                      >
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-gray-400 w-6 text-right">
                              {idx + 1}.
                            </span>
                            <span className="truncate" title={p.name}>
                              {p.name}
                            </span>
                          </span>
                          <span className="font-mono text-gray-700 ml-2">
                            {p.count} 件
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded ml-8 overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded"
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
      <section className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold mb-3">提案成功ランキング</h2>
        {data.proposalSuccess.length === 0 ? (
          <p className="text-sm text-gray-400">データなし</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="py-2 pr-3">項目</th>
                <th className="py-2 pr-3 text-right">成功</th>
                <th className="py-2 pr-3 text-right">提案数</th>
                <th className="py-2 pr-3 w-48">成功率</th>
                <th className="py-2 text-right">率</th>
              </tr>
            </thead>
            <tbody>
              {data.proposalSuccess.map((row) => {
                const rate =
                  row.proposed > 0 ? (row.success / row.proposed) * 100 : 0;
                const rateColor =
                  rate >= 50
                    ? "bg-emerald-500"
                    : rate >= 25
                    ? "bg-amber-400"
                    : "bg-rose-400";
                return (
                  <tr key={row.key} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/recordings?${new URLSearchParams({
                          success: row.key,
                          start_date: data.rangeStartYmd,
                          end_date: data.rangeEndYmd,
                          ...(operator ? { operator } : {}),
                        }).toString()}`}
                        className="hover:underline"
                      >
                        {PROPOSAL_LABEL_BY_KEY.get(row.key) ?? row.key}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-green-700">
                      {row.success}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-gray-600">
                      {row.proposed}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="h-2 bg-gray-100 rounded overflow-hidden">
                        <div
                          className={`h-full ${rateColor} rounded`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2 text-right font-mono">
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
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          全録音一覧を見る（このフィルタを引き継ぐ）
        </Link>
      </div>
    </section>
  );
}
