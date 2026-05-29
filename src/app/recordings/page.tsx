import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { PROPOSAL_ITEMS } from "@/lib/proposal/items";
import { callTypeLabel, callTypeBadgeClass } from "@/lib/call-type";
import { fetchProducts } from "@/lib/products/queries";
import {
  buildSearchParams,
  fetchFilteredRecordings,
  fetchKnownProductGroups,
  parseRecordingsFilterFromSearchParams,
  type Recording,
} from "@/lib/recordings/queries";
import { FilterPanel } from "./_components/FilterPanel";

export const dynamic = "force-dynamic";

const PROPOSAL_LABEL_BY_KEY = new Map(PROPOSAL_ITEMS.map((p) => [p.key, p.label]));

// 商品列の表示フラグ。受注紐付けの進捗を優先したいので一旦 false。
// 将来また見たくなったら true に戻すだけで復活する (col/th/td 3 か所が同時に出る)。
// 2026-05-25
const SHOW_PRODUCTS_COLUMN = false;

function formatDuration(sec: number | null): string {
  if (sec == null) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { hour12: false, timeZone: "Asia/Tokyo" });
}

function operatorDisplayName(
  email: string | null,
  byEmail: Map<string, string | null>
): string {
  if (!email) return "未設定";
  const name = byEmail.get(email);
  if (name && name.trim()) return name;
  return email.split("@")[0];
}

function searchParamsToURLSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const item of v) sp.append(k, item);
    else sp.append(k, v);
  }
  return sp;
}

export default async function RecordingsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin();
  const supabase = createClient();

  const sp = searchParamsToURLSearchParams(searchParams);
  const filter = parseRecordingsFilterFromSearchParams(sp);
  const page = Math.max(1, parseInt((searchParams.page as string) ?? "1", 10) || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;

  const { rows, count, proposalsBySession, linkedOrdersBySession, displayNamesByEmail } =
    await fetchFilteredRecordings(supabase, filter, { page, pageSize });

  const totalPages = count ? Math.ceil(count / pageSize) : 1;
  const productMaster = await fetchProducts(false);
  const productGroupMaster = await fetchKnownProductGroups(supabase);

  const csvHref = `/api/recordings/export?${buildSearchParams(filter).toString()}`;
  const prevHref = `/recordings?${buildSearchParams(filter, { page: String(page - 1) }).toString()}`;
  const nextHref = `/recordings?${buildSearchParams(filter, { page: String(page + 1) }).toString()}`;

  return (
    <section>
      <h1 className="text-2xl font-bold mb-4">録音一覧</h1>

      <FilterPanel
        filter={filter}
        productMaster={productMaster}
        productGroupMaster={productGroupMaster}
        csvHref={csvHref}
      />

      <p className="text-xs text-gray-500 mb-1">
        ※ 画面に収まらない列は、表の下にあるスクロールバーで横にスクロールすると見えます（受注番号・提案成功・ステータス・操作 など右側にあります）。
      </p>
      <div className="bg-white rounded shadow overflow-x-scroll">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[140px]" />{/* 録音日時 */}
            <col className="w-[64px]" />{/* 時間 */}
            <col className="w-[100px]" />{/* セッションID */}
            <col className="w-[110px]" />{/* 対応者 */}
            <col className="w-[90px]" />{/* 種別 */}
            <col className="w-[240px]" />{/* タイトル */}
            {SHOW_PRODUCTS_COLUMN && <col className="w-[180px]" />/* 商品 */}
            <col className="w-[180px]" />{/* 商品グループ */}
            <col className="w-[140px]" />{/* 受注番号 */}
            <col className="w-[280px]" />{/* 内容 */}
            <col className="w-[140px]" />{/* 提案成功 */}
            <col className="w-[100px]" />{/* ステータス */}
            <col className="w-[60px]" />{/* 操作 */}
          </colgroup>
          <thead className="bg-gray-100 text-left sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2">録音日時</th>
              <th className="px-3 py-2">時間</th>
              <th className="px-3 py-2">セッションID</th>
              <th className="px-3 py-2">対応者</th>
              <th className="px-3 py-2">種別</th>
              <th className="px-3 py-2">タイトル</th>
              {SHOW_PRODUCTS_COLUMN && <th className="px-3 py-2">商品</th>}
              <th className="px-3 py-2">商品グループ</th>
              <th className="px-3 py-2">受注番号</th>
              <th className="px-3 py-2">内容</th>
              <th className="px-3 py-2">提案成功</th>
              <th className="px-3 py-2">ステータス</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: Recording) => {
              const transcript = r.transcripts?.[0];
              const successKeys = Array.from(proposalsBySession.get(r.session_id) ?? []);
              const titleText = transcript?.title ?? "-";
              const summaryText = (transcript?.summary ?? "").replace(/\s+/g, " ").trim();
              return (
                <tr key={r.id} className="border-t hover:bg-gray-50 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDateTime(r.started_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDuration(r.duration_sec)}</td>
                  <td className="px-3 py-2 font-mono text-xs truncate">{r.session_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2 truncate" title={r.operator_email ?? ""}>
                    {operatorDisplayName(r.operator_email, displayNamesByEmail)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.call_type ? (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${callTypeBadgeClass(r.call_type)}`}
                      >
                        {callTypeLabel(r.call_type)}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 truncate" title={titleText}>
                    {titleText}
                  </td>
                  {SHOW_PRODUCTS_COLUMN && (
                    <td className="px-3 py-2">
                      {(transcript?.products ?? []).length === 0 ? (
                        <span className="text-gray-300 text-xs">-</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(transcript?.products ?? []).map((name) => (
                            <Link
                              key={name}
                              href={`/recordings?${buildSearchParams({ products: [name], productMatch: "or" }).toString()}`}
                              className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200 whitespace-nowrap"
                            >
                              {name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    {(() => {
                      const linked = linkedOrdersBySession.get(r.session_id);
                      if (!linked || linked.productGroups.length === 0) {
                        return <span className="text-gray-300 text-xs">-</span>;
                      }
                      return (
                        <div className="flex flex-wrap gap-1">
                          {linked.productGroups.map((g) => (
                            <Link
                              key={g}
                              href={`/recordings?${buildSearchParams({ productGroups: [g], productGroupMatch: "or" }).toString()}`}
                              className={`text-xs px-1.5 py-0.5 rounded border whitespace-nowrap ${g === "未分類" ? "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200" : "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"}`}
                            >
                              {g}
                            </Link>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2">
                    {(() => {
                      const linked = linkedOrdersBySession.get(r.session_id);
                      if (!linked || linked.orderNumbers.length === 0) {
                        return <span className="text-gray-300 text-xs">-</span>;
                      }
                      return (
                        <div
                          className="flex flex-col gap-0.5 text-xs font-mono text-gray-700"
                          title={linked.orderNumbers.join("\n")}
                        >
                          {linked.orderNumbers.map((num) => (
                            <span key={num} className="whitespace-nowrap">
                              {num}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 text-xs truncate" title={summaryText}>
                    {summaryText || "-"}
                  </td>
                  <td className="px-3 py-2">
                    {successKeys.length === 0 ? (
                      <span className="text-gray-300 text-xs">-</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {successKeys.map((key) => (
                          <span
                            key={key}
                            className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-300 whitespace-nowrap"
                          >
                            {PROPOSAL_LABEL_BY_KEY.get(key) ?? key}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-200">{r.status}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/recordings/${r.session_id}`} className="text-blue-600 hover:underline">
                      詳細
                    </Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-gray-500">
                  該当する録音がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span>
          {count} 件中 {count === 0 ? 0 : from + 1}-{Math.min(from + pageSize, count)}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={prevHref} className="px-3 py-1 border rounded">
              前へ
            </Link>
          )}
          {page < totalPages && (
            <Link href={nextHref} className="px-3 py-1 border rounded">
              次へ
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
