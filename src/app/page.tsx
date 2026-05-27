import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchDashboardData, formatDurationSec } from "@/lib/dashboard/queries";
import { estimateApiCost } from "@/lib/dashboard/api-cost";
import { jstMonthStartYmd, jstTodayYmd } from "@/lib/dashboard/date";
import { PROPOSAL_ITEMS } from "@/lib/proposal/items";
import { DailyCallChart } from "./_components/DailyCallChart";

export const dynamic = "force-dynamic";

const PROPOSAL_LABEL_BY_KEY = new Map(PROPOSAL_ITEMS.map((p) => [p.key, p.label]));

export default async function DashboardPage() {
  await requireAdmin();
  const supabase = createClient();
  const data = await fetchDashboardData(supabase);
  const cost = estimateApiCost(data.transcriptCountMonth);
  const todayYmd = jstTodayYmd();
  const monthYmd = jstMonthStartYmd();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-xs text-gray-500 mt-1">
          今月の集計 ({monthYmd} 〜 {todayYmd}) — 各カードをクリックで該当の録音一覧に遷移
        </p>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href={`/recordings?start_date=${todayYmd}&end_date=${todayYmd}`}
          className="bg-white border rounded-lg p-4 hover:shadow transition"
        >
          <div className="text-xs text-gray-600">今日の受電数</div>
          <div className="text-3xl font-bold mt-1">{data.todayCallCount}</div>
          <div className="text-xs text-gray-400 mt-1">({todayYmd})</div>
        </Link>

        <Link
          href={`/recordings?start_date=${monthYmd}&end_date=${todayYmd}`}
          className="bg-white border rounded-lg p-4 hover:shadow transition"
        >
          <div className="text-xs text-gray-600">今月の受電数</div>
          <div className="text-3xl font-bold mt-1">{data.monthCallCount}</div>
          <div className="text-xs text-gray-400 mt-1">({monthYmd} 〜)</div>
        </Link>

        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-600">平均通話時間（今月）</div>
          <div className="text-3xl font-bold mt-1">
            {formatDurationSec(data.avgDurationSecMonth)}
          </div>
          <div className="text-xs text-gray-400 mt-1">m:ss</div>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-600">概算 API 費用（今月）</div>
          <div className="text-3xl font-bold mt-1">
            ¥{cost.totalJpy.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            ${cost.totalUsd} 内訳: Gemini ${cost.geminiUsd} / Run $
            {cost.cloudRunUsd} / Supabase ${cost.supabaseUsd}
          </div>
        </div>
      </div>

      {/* Daily call trend chart */}
      <section className="bg-white border rounded-lg p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">日別受電数（今月）</h2>
          <span className="text-xs text-gray-400">棒をクリックでその日の録音一覧</span>
        </div>
        <DailyCallChart data={data.dailyCallsMonth} />
      </section>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top operators */}
        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3">受電トップオペレーター（今月）</h2>
          {data.topOperatorsMonth.length === 0 ? (
            <p className="text-sm text-gray-400">データなし</p>
          ) : (
            <ol className="space-y-2">
              {(() => {
                const max = Math.max(
                  1,
                  ...data.topOperatorsMonth.map((o) => o.count)
                );
                return data.topOperatorsMonth.map((op, idx) => {
                  const pct = (op.count / max) * 100;
                  return (
                    <li key={op.email}>
                      <Link
                        href={`/recordings?operator=${encodeURIComponent(op.email)}&start_date=${monthYmd}&end_date=${todayYmd}`}
                        className="block hover:bg-gray-50 rounded px-2 py-1 -mx-2"
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
          <h2 className="font-semibold mb-3">受電が多い商材（今月）</h2>
          {data.topProductsMonth.length === 0 ? (
            <p className="text-sm text-gray-400">データなし</p>
          ) : (
            <ol className="space-y-2">
              {(() => {
                const max = Math.max(
                  1,
                  ...data.topProductsMonth.map((p) => p.count)
                );
                return data.topProductsMonth.map((p, idx) => {
                  const pct = (p.count / max) * 100;
                  return (
                    <li key={p.name}>
                      <Link
                        href={`/recordings?product=${encodeURIComponent(p.name)}&start_date=${monthYmd}&end_date=${todayYmd}`}
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
        <h2 className="font-semibold mb-3">提案成功ランキング（今月）</h2>
        {data.proposalSuccessMonth.length === 0 ? (
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
              {data.proposalSuccessMonth.map((row) => {
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
                        href={`/recordings?success=${row.key}&start_date=${monthYmd}&end_date=${todayYmd}`}
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
          href="/recordings"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          📋 全録音一覧を見る
        </Link>
      </div>
    </section>
  );
}
