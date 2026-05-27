import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatDurationSec,
} from "@/lib/dashboard/queries";
import {
  fetchMeData,
  proposalSuccessMap,
  calcOverallProposalRate,
} from "@/lib/me/queries";
import { resolvePeriodRange } from "@/lib/dashboard/date";
import { PROPOSAL_ITEMS } from "@/lib/proposal/items";
import { DailyCallChart } from "../_components/DailyCallChart";
import { DisplayNameForm } from "./_components/DisplayNameForm";

export const dynamic = "force-dynamic";

const PROPOSAL_LABEL_BY_KEY = new Map(
  PROPOSAL_ITEMS.map((p) => [p.key, p.label])
);

export default async function MyPage() {
  const user = await requireUser();
  const supabase = createClient();

  const range = resolvePeriodRange("this_month");
  const { me, prev, global, prevRange } = await fetchMeData(
    supabase,
    user.email,
    range
  );

  // 個人の提案成功率（加重平均）
  const meRate = calcOverallProposalRate(proposalSuccessMap(me));
  const prevRate = calcOverallProposalRate(proposalSuccessMap(prev));
  const globalOverallRate = (() => {
    const rates = [...global.proposalSuccessRate.values()];
    if (rates.length === 0) return null;
    return rates.reduce((s, n) => s + n, 0) / rates.length;
  })();

  // 総通話時間 (秒) = 平均×件数 (概算)
  const myTotalDurationSec =
    me.avgDurationSec != null ? me.avgDurationSec * me.rangeCallCount : 0;

  const recordingsBaseQs = (extra: Record<string, string> = {}) =>
    new URLSearchParams({
      operator: user.email,
      start_date: me.rangeStartYmd,
      end_date: me.rangeEndYmd,
      ...extra,
    }).toString();

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">マイページ</h1>
        <p className="text-xs text-gray-500 mt-1">
          {user.displayName ?? user.email} の今月の成果（{me.rangeStartYmd} 〜{" "}
          {me.rangeEndYmd}）
        </p>
      </header>

      {/* 表示名編集 */}
      <DisplayNameForm
        initial={user.displayName ?? ""}
        email={user.email}
      />

      {/* 個人 KPI + 全体平均比較 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href={`/recordings?${recordingsBaseQs()}`}
          className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 hover:shadow-md transition"
        >
          <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
            今月の受電
          </div>
          <div className="text-4xl font-bold text-blue-900 mt-2 tabular-nums">
            {me.rangeCallCount}
          </div>
          <CompareLine
            label="全体平均"
            self={me.rangeCallCount}
            global={global.avgCallsPerOperator}
            colorClass="text-blue-700/70"
            higherIsBetter
            unit="件"
          />
        </Link>

        <div className="bg-gradient-to-br from-violet-50 to-violet-100 border border-violet-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-violet-700 uppercase tracking-wider">
            平均通話時間
          </div>
          <div className="text-4xl font-bold text-violet-900 mt-2 tabular-nums">
            {formatDurationSec(me.avgDurationSec)}
          </div>
          <CompareLineDuration
            self={me.avgDurationSec}
            global={global.avgDurationSec}
            colorClass="text-violet-700/70"
          />
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            提案成功率
          </div>
          <div className="text-4xl font-bold text-emerald-900 mt-2 tabular-nums">
            {meRate != null ? `${meRate.toFixed(1)}%` : "-"}
          </div>
          <CompareLine
            label="全体平均"
            self={meRate}
            global={globalOverallRate}
            colorClass="text-emerald-700/70"
            higherIsBetter
            unit="%"
            decimals={1}
          />
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
            総通話時間
          </div>
          <div className="text-3xl font-bold text-amber-900 mt-2 tabular-nums">
            {formatHoursMin(myTotalDurationSec)}
          </div>
          <div className="text-[10px] text-amber-700/70 mt-1">
            {me.rangeCallCount}件 ×{" "}
            {formatDurationSec(me.avgDurationSec)}
          </div>
        </div>
      </div>

      {/* 前月比 */}
      <section className="bg-white border rounded-lg p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">先月との比較</h2>
          <span className="text-xs text-gray-400">
            {prevRange.label}（{prevRange.startYmd} 〜 {prevRange.endYmd}）
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DiffCard
            title="受電数"
            current={me.rangeCallCount}
            previous={prev.rangeCallCount}
            unit="件"
            higherIsBetter
          />
          <DiffCard
            title="提案成功率"
            current={meRate}
            previous={prevRate}
            unit="%"
            decimals={1}
            higherIsBetter
          />
          <DiffCard
            title="平均通話時間"
            current={me.avgDurationSec}
            previous={prev.avgDurationSec}
            formatter={formatDurationSec}
            higherIsBetter={false}
          />
        </div>
      </section>

      {/* 日別チャート */}
      <section className="bg-white border rounded-lg p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">日別の受電数</h2>
          <span className="text-xs text-gray-400">棒クリックで詳細</span>
        </div>
        <DailyCallChart
          data={me.dailyCalls}
          operatorParam={user.email}
        />
      </section>

      {/* 商材ランク + 提案テーブル */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3">よく対応した商材</h2>
          {me.topProducts.length === 0 ? (
            <p className="text-sm text-gray-400">データなし</p>
          ) : (
            <ol className="space-y-2">
              {(() => {
                const max = Math.max(1, ...me.topProducts.map((p) => p.count));
                return me.topProducts.map((p, idx) => {
                  const pct = (p.count / max) * 100;
                  return (
                    <li key={p.name}>
                      <Link
                        href={`/recordings?${recordingsBaseQs({ product: p.name })}`}
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

        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3">あなたの提案成功</h2>
          {me.proposalSuccess.length === 0 ? (
            <p className="text-sm text-gray-400">データなし</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-2 pr-2">項目</th>
                  <th className="py-2 pr-2 text-right">成功</th>
                  <th className="py-2 pr-2 text-right">提案</th>
                  <th className="py-2 text-right">率 / 全体</th>
                </tr>
              </thead>
              <tbody>
                {me.proposalSuccess.map((row) => {
                  const rate =
                    row.proposed > 0 ? (row.success / row.proposed) * 100 : 0;
                  const globalRate = global.proposalSuccessRate.get(row.key);
                  const better =
                    globalRate != null ? rate >= globalRate : null;
                  return (
                    <tr key={row.key} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">
                        <Link
                          href={`/recordings?${recordingsBaseQs({ success: row.key })}`}
                          className="hover:underline"
                        >
                          {PROPOSAL_LABEL_BY_KEY.get(row.key) ?? row.key}
                        </Link>
                      </td>
                      <td className="py-2 pr-2 text-right font-mono text-green-700">
                        {row.success}
                      </td>
                      <td className="py-2 pr-2 text-right font-mono text-gray-600">
                        {row.proposed}
                      </td>
                      <td className="py-2 text-right font-mono text-xs">
                        <span
                          className={
                            better === true
                              ? "text-emerald-700 font-semibold"
                              : better === false
                              ? "text-gray-500"
                              : "text-gray-700"
                          }
                        >
                          {rate.toFixed(1)}%
                        </span>
                        {globalRate != null && (
                          <span className="text-gray-400 text-[10px]">
                            {" / "}
                            {globalRate.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="text-center mt-6">
        <Link
          href={`/recordings?${recordingsBaseQs()}`}
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          自分の録音を全部見る
        </Link>
      </div>
    </section>
  );
}

function CompareLine({
  label,
  self,
  global,
  colorClass,
  higherIsBetter,
  unit,
  decimals = 0,
}: {
  label: string;
  self: number | null;
  global: number | null;
  colorClass: string;
  higherIsBetter: boolean;
  unit: string;
  decimals?: number;
}) {
  if (self == null || global == null) {
    return <div className={`text-[10px] mt-1 ${colorClass}`}>{label}: -</div>;
  }
  const diff = self - global;
  const better = higherIsBetter ? diff >= 0 : diff <= 0;
  const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
  const diffText = `${arrow} ${Math.abs(diff).toFixed(decimals)}${unit}`;
  const cls = better ? "text-emerald-700" : "text-gray-500";
  return (
    <div className={`text-[10px] mt-1 ${colorClass}`}>
      {label} {global.toFixed(decimals)}
      {unit}（<span className={`${cls} font-semibold`}>{diffText}</span>）
    </div>
  );
}

function CompareLineDuration({
  self,
  global,
  colorClass,
}: {
  self: number | null;
  global: number | null;
  colorClass: string;
}) {
  if (self == null || global == null) {
    return <div className={`text-[10px] mt-1 ${colorClass}`}>全体平均: -</div>;
  }
  const diff = self - global;
  const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
  const absMin = Math.floor(Math.abs(diff) / 60);
  const absSec = Math.abs(diff) % 60;
  const diffText = `${arrow} ${absMin}:${absSec.toString().padStart(2, "0")}`;
  return (
    <div className={`text-[10px] mt-1 ${colorClass}`}>
      全体平均 {formatDurationSec(global)}（{diffText}）
    </div>
  );
}

function DiffCard({
  title,
  current,
  previous,
  unit,
  decimals = 0,
  higherIsBetter,
  formatter,
}: {
  title: string;
  current: number | null;
  previous: number | null;
  unit?: string;
  decimals?: number;
  higherIsBetter: boolean;
  formatter?: (v: number | null) => string;
}) {
  const fmt = (v: number | null) =>
    formatter
      ? formatter(v)
      : v == null
      ? "-"
      : `${v.toFixed(decimals)}${unit ?? ""}`;

  let arrow = "→";
  let diffText = "変化なし";
  let colorCls = "text-gray-500";
  if (current != null && previous != null) {
    const diff = current - previous;
    if (Math.abs(diff) > 0.0001) {
      arrow = diff > 0 ? "↑" : "↓";
      const better = higherIsBetter ? diff > 0 : diff < 0;
      colorCls = better ? "text-emerald-700" : "text-rose-600";
      if (formatter) {
        diffText = `${arrow} ${formatter(Math.abs(diff))}`;
      } else {
        diffText = `${arrow} ${Math.abs(diff).toFixed(decimals)}${unit ?? ""}`;
      }
    }
  }

  return (
    <div className="border rounded-lg p-3">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-bold tabular-nums">{fmt(current)}</span>
        <span className="text-xs text-gray-400">/ 先月 {fmt(previous)}</span>
      </div>
      <div className={`text-xs font-semibold mt-1 ${colorCls}`}>{diffText}</div>
    </div>
  );
}

function formatHoursMin(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}
