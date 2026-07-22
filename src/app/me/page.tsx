import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatDurationSec,
} from "@/lib/dashboard/queries";
import {
  fetchMeData,
  fetchMyCalls,
  proposalSuccessMap,
  calcOverallProposalRate,
} from "@/lib/me/queries";
import { MyCalls } from "./my-calls";
import { jstTodayYmd, resolvePeriodRange } from "@/lib/dashboard/date";
import { PROPOSAL_ITEMS } from "@/lib/proposal/items";
import { callTypeLabel, callTypeBadgeClass } from "@/lib/call-type";
import { DailyCallChart } from "../_components/DailyCallChart";
import { DisplayNameForm } from "./_components/DisplayNameForm";
import {
  DailyReportView,
  type DailyReport,
} from "./_components/DailyReportView";
import { GenerateReportButton } from "./_components/GenerateReportButton";

export const dynamic = "force-dynamic";

const PROPOSAL_LABEL_BY_KEY = new Map(
  PROPOSAL_ITEMS.map((p) => [p.key, p.label])
);

export default async function MyPage() {
  const user = await requireUser();
  const supabase = createClient();

  const range = resolvePeriodRange("this_month");
  const todayYmd = jstTodayYmd();
  const [meDataResult, todayReportRow, myCalls] = await Promise.all([
    fetchMeData(supabase, user.email, range),
    supabase
      .from("daily_reports")
      .select("highlights, overall_comment, generated_at, tokens_in, tokens_out, model")
      .eq("operator_email", user.email)
      .eq("report_date", todayYmd)
      .maybeSingle(),
    // 自分の通話（振り返り用）。他人の通話は取得しない。
    fetchMyCalls(supabase, user.email, 50),
  ]);
  const { me, prev, global, prevRange } = meDataResult;
  const todayReport = (todayReportRow.data as DailyReport | null) ?? null;

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
    <section className="space-y-6">
      <header>
        <div className="text-xs font-bold text-brand-leaf tracking-widest">
          MY PAGE
        </div>
        <h1 className="text-3xl font-extrabold text-brand-green">マイページ</h1>
        <div className="mt-1 h-1 w-12 rounded-full bg-brand-sakura" />
        <p className="text-xs text-brand-sub mt-2">
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
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
          ✨
        </span>
        <h2 className="font-bold text-brand-green">今月の実績</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <Link
          href={`/recordings?${recordingsBaseQs()}`}
          className="rounded-card p-5 shadow-softlg bg-gradient-to-br from-brand-green to-brand-dark text-white hover:-translate-y-0.5 transition"
        >
          <div className="text-xs font-bold text-white/80 tracking-wider">
            今月の受電
          </div>
          <div className="text-4xl font-extrabold text-white mt-2 tabular-nums leading-none">
            {me.rangeCallCount}
          </div>
          <CompareLine
            label="全体平均"
            self={me.rangeCallCount}
            global={global.avgCallsPerOperator}
            colorClass="text-white/75"
            higherIsBetter
            unit="件"
          />
        </Link>

        <div className="bg-brand-soft rounded-card p-5">
          <div className="text-xs font-bold text-brand-green tracking-wider">
            平均通話時間
          </div>
          <div className="text-4xl font-extrabold text-brand-green mt-2 tabular-nums leading-none">
            {formatDurationSec(me.avgDurationSec)}
          </div>
          <CompareLineDuration
            self={me.avgDurationSec}
            global={global.avgDurationSec}
            colorClass="text-brand-sub"
          />
        </div>

        <div className="bg-brand-soft rounded-card p-5">
          <div className="text-xs font-bold text-brand-green tracking-wider">
            提案成功率
          </div>
          <div className="text-4xl font-extrabold text-brand-green mt-2 tabular-nums leading-none">
            {meRate != null ? `${meRate.toFixed(1)}%` : "-"}
          </div>
          <CompareLine
            label="全体平均"
            self={meRate}
            global={globalOverallRate}
            colorClass="text-brand-sub"
            higherIsBetter
            unit="%"
            decimals={1}
          />
        </div>

        <div className="bg-brand-soft rounded-card p-5">
          <div className="text-xs font-bold text-brand-green tracking-wider">
            総通話時間
          </div>
          <div className="text-3xl font-extrabold text-brand-green mt-2 tabular-nums leading-none">
            {formatHoursMin(myTotalDurationSec)}
          </div>
          <div className="text-[10px] text-brand-sub mt-1">
            {me.rangeCallCount}件 ×{" "}
            {formatDurationSec(me.avgDurationSec)}
          </div>
        </div>
      </div>

      {/* 前月比 */}
      <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
              📅
            </span>
            <h2 className="font-bold text-brand-green">先月との比較</h2>
          </div>
          <span className="text-xs text-brand-sub">
            {prevRange.label}（{prevRange.startYmd} 〜 {prevRange.endYmd}）
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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

      {/* 今日のレポート */}
      {todayReport ? (
        <DailyReportView report={todayReport} />
      ) : (
        <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
                📝
              </span>
              <h2 className="font-bold text-brand-green">今日のレポート</h2>
            </div>
            <p className="text-xs text-brand-sub mt-1">
              本日（{todayYmd}）の通話を AI に分析させて、注目したい4カテゴリの会話を抽出します。
            </p>
            <p className="text-[10px] text-brand-sub mt-1">
              生成コスト: 1回あたり 約 ¥0.2（任意なので押した時だけ）
            </p>
          </div>
          <GenerateReportButton />
        </section>
      )}

      {/* 日別チャート */}
      <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
              📊
            </span>
            <h2 className="font-bold text-brand-green">日別の受電数</h2>
          </div>
          <span className="text-xs text-brand-sub">棒クリックで詳細</span>
        </div>
        <DailyCallChart
          data={me.dailyCalls}
          operatorParam={user.email}
        />
      </section>

      {/* 通話種別の内訳 */}
      {me.callTypeBreakdown.length > 0 && (
        <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
              🗂️
            </span>
            <h2 className="font-bold text-brand-green">通話種別の内訳</h2>
          </div>
          {(() => {
            const total = me.callTypeBreakdown.reduce((s, c) => s + c.count, 0);
            return (
              <div className="space-y-2">
                {me.callTypeBreakdown.map((c) => {
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
                      <div className="h-2 bg-brand-soft rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-leaf rounded-full"
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

      {/* 商材ランク + 提案テーブル */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
              🌿
            </span>
            <h2 className="font-bold text-brand-green">よく対応した商材</h2>
          </div>
          {me.topProducts.length === 0 ? (
            <p className="text-sm text-brand-sub">データなし</p>
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
                        className="block hover:bg-brand-soft/50 rounded-lg px-2 py-1 -mx-2"
                      >
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-brand-sub w-6 text-right">
                              {idx + 1}.
                            </span>
                            <span className="truncate text-brand-ink" title={p.name}>
                              {p.name}
                            </span>
                          </span>
                          <span className="font-mono text-brand-ink ml-2">
                            {p.count} 件
                          </span>
                        </div>
                        <div className="h-2 bg-brand-soft rounded-full ml-8 overflow-hidden">
                          <div
                            className="h-full bg-brand-leaf rounded-full"
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

        <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
              🎯
            </span>
            <h2 className="font-bold text-brand-green">あなたの提案成功</h2>
          </div>
          {me.proposalSuccess.length === 0 ? (
            <p className="text-sm text-brand-sub">データなし</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-brand-sub bg-brand-soft">
                  <th className="py-2 px-3 rounded-l-lg">項目</th>
                  <th className="py-2 px-3 text-right">成功</th>
                  <th className="py-2 px-3 text-right">提案</th>
                  <th className="py-2 px-3 text-right rounded-r-lg">率 / 全体</th>
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
                    <tr key={row.key} className="border-b border-brand-border last:border-b-0">
                      <td className="py-2 px-3">
                        <Link
                          href={`/recordings?${recordingsBaseQs({ success: row.key })}`}
                          className="text-brand-green hover:underline"
                        >
                          {PROPOSAL_LABEL_BY_KEY.get(row.key) ?? row.key}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-brand-green font-bold">
                        {row.success}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-brand-sub">
                        {row.proposed}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-xs">
                        <span
                          className={
                            better === true
                              ? "text-brand-green font-bold"
                              : better === false
                              ? "text-brand-sub"
                              : "text-brand-ink"
                          }
                        >
                          {rate.toFixed(1)}%
                        </span>
                        {globalRate != null && (
                          <span className="text-brand-sub text-[10px]">
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

      <section className="mt-8">
        <h2 className="font-bold text-brand-green">自分の通話を振り返る</h2>
        <p className="mt-1 mb-3 text-xs text-brand-sub">
          直近50件です。「書き起こしを見る」で要約・全文を確認、「音声DL」で自分の通話の音声を保存できます（自分の通話のみ）。
        </p>
        <MyCalls calls={myCalls} />
      </section>

      <div className="text-center mt-6">
        <Link
          href={`/recordings?${recordingsBaseQs()}`}
          className="inline-block bg-brand-green text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-dark hover:-translate-y-0.5 transition shadow-soft"
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
  const cls = better ? "text-brand-leaf font-bold" : "text-brand-sakura";
  return (
    <div className={`text-[10px] mt-1 ${colorClass}`}>
      {label} {global.toFixed(decimals)}
      {unit}（<span className={cls}>{diffText}</span>）
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
  let colorCls = "text-brand-sub";
  if (current != null && previous != null) {
    const diff = current - previous;
    if (Math.abs(diff) > 0.0001) {
      arrow = diff > 0 ? "↑" : "↓";
      const better = higherIsBetter ? diff > 0 : diff < 0;
      colorCls = better ? "text-brand-green" : "text-brand-sakura";
      if (formatter) {
        diffText = `${arrow} ${formatter(Math.abs(diff))}`;
      } else {
        diffText = `${arrow} ${Math.abs(diff).toFixed(decimals)}${unit ?? ""}`;
      }
    }
  }

  return (
    <div className="bg-brand-soft rounded-xl p-3">
      <div className="text-xs text-brand-sub">{title}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-extrabold text-brand-green tabular-nums">{fmt(current)}</span>
        <span className="text-xs text-brand-sub">/ 先月 {fmt(previous)}</span>
      </div>
      <div className={`text-xs font-bold mt-1 ${colorCls}`}>{diffText}</div>
    </div>
  );
}

function formatHoursMin(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}
