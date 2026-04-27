import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { PROPOSAL_ITEMS } from "@/lib/proposal/items";
import { fetchProducts } from "@/lib/products/queries";

export const dynamic = "force-dynamic";

type Recording = {
  id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  operator_email: string | null;
  status: string;
  transcripts: Array<{
    title: string | null;
    summary: string | null;
    merged_text: string | null;
    products: string[] | null;
  }>;
};

type UserRoleRow = {
  email: string;
  display_name: string | null;
};

type ProposalRow = {
  session_id: string;
  items: Record<string, unknown>;
};

const PROPOSAL_LABEL_BY_KEY = new Map(PROPOSAL_ITEMS.map((p) => [p.key, p.label]));

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

function truncate(text: string | null, max = 80): string {
  if (!text) return "";
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

function asArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value) return [value];
  return [];
}

function buildHref(
  base: string,
  params: Record<string, string | undefined>,
  successKeys: string[],
  productNames: string[] = []
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  for (const k of successKeys) sp.append("success", k);
  for (const p of productNames) sp.append("product", p);
  return `${base}?${sp.toString()}`;
}

export default async function RecordingsPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    q?: string;
    operator?: string;
    success?: string | string[];
    match?: string;
    product?: string | string[];
    product_match?: string;
  };
}) {
  await requireAdmin();
  const supabase = createClient();

  const successFilter = asArray(searchParams.success);
  const matchMode: "and" | "or" = searchParams.match === "or" ? "or" : "and";
  const productFilter = asArray(searchParams.product);
  const productMatchMode: "and" | "or" =
    searchParams.product_match === "or" ? "or" : "and";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // If the user filtered by successful proposal items, narrow recordings via
  // the proposals table first.
  // - AND: every selected key must be "1" on the SAME proposals row
  // - OR : at least one selected key must be "1" on ANY proposals row
  let allowedSessionIds: string[] | null = null;
  if (successFilter.length > 0) {
    let pq = supabase.from("proposals").select("session_id");
    if (matchMode === "and") {
      for (const key of successFilter) {
        pq = pq.eq(`items->>${key}`, "1");
      }
    } else {
      const orClause = successFilter
        .map((key) => `items->>${key}.eq.1`)
        .join(",");
      pq = pq.or(orClause);
    }
    const { data: matched, error: pqErr } = await pq;
    if (pqErr) {
      return <p className="text-red-600">エラー: {pqErr.message}</p>;
    }
    allowedSessionIds = Array.from(
      new Set((matched ?? []).map((m: { session_id: string }) => m.session_id))
    );
    if (allowedSessionIds.length === 0) {
      // Render the form + empty state without hitting recordings at all.
      return renderEmpty(searchParams, successFilter, matchMode);
    }
  }

  // Narrow recordings further by product names mentioned in the call.
  // - AND: transcripts.products must contain every selected name (`@>`)
  // - OR : transcripts.products must overlap any selected name (`&&`)
  let allowedRecordingIds: string[] | null = null;
  if (productFilter.length > 0) {
    let tq = supabase.from("transcripts").select("recording_id");
    if (productMatchMode === "and") {
      tq = tq.contains("products", productFilter);
    } else {
      tq = tq.overlaps("products", productFilter);
    }
    const { data: matchedTrans, error: tqErr } = await tq;
    if (tqErr) {
      return <p className="text-red-600">エラー: {tqErr.message}</p>;
    }
    allowedRecordingIds = Array.from(
      new Set((matchedTrans ?? []).map((m: { recording_id: string }) => m.recording_id))
    );
    if (allowedRecordingIds.length === 0) {
      return renderEmpty(searchParams, successFilter, matchMode);
    }
  }

  let query = supabase
    .from("recordings")
    .select(
      "id,session_id,started_at,ended_at,duration_sec,operator_email,status,transcripts(title,summary,merged_text,products)",
      { count: "exact" }
    )
    .order("started_at", { ascending: false })
    .range(from, to);

  if (searchParams.operator) {
    query = query.ilike("operator_email", `%${searchParams.operator}%`);
  }
  if (allowedSessionIds) {
    query = query.in("session_id", allowedSessionIds);
  }
  if (allowedRecordingIds) {
    query = query.in("id", allowedRecordingIds);
  }

  const { data: recordings, count, error } = await query;
  if (error) {
    return <p className="text-red-600">エラー: {error.message}</p>;
  }

  const sessionIds = (recordings ?? []).map((r: Recording) => r.session_id);

  // Pull proposals for the visible page so we can render a "提案成功" column
  // even when no filter is active.
  let proposalsBySession = new Map<string, Set<string>>();
  if (sessionIds.length > 0) {
    const { data: proposalRows } = await supabase
      .from("proposals")
      .select("session_id,items")
      .in("session_id", sessionIds);
    for (const p of (proposalRows ?? []) as ProposalRow[]) {
      const set = proposalsBySession.get(p.session_id) ?? new Set<string>();
      for (const [k, v] of Object.entries(p.items ?? {})) {
        if (v === "1") set.add(k);
      }
      proposalsBySession.set(p.session_id, set);
    }
  }

  const emails = Array.from(
    new Set((recordings ?? []).map((r: Recording) => r.operator_email).filter((e): e is string => Boolean(e)))
  );
  let byEmail = new Map<string, string | null>();
  if (emails.length > 0) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("email,display_name")
      .in("email", emails);
    byEmail = new Map((roles ?? []).map((r: UserRoleRow) => [r.email, r.display_name]));
  }

  const filtered = (recordings ?? []).filter((r: Recording) => {
    if (!searchParams.q) return true;
    const needle = searchParams.q.toLowerCase();
    const title = r.transcripts?.[0]?.title ?? "";
    return title.toLowerCase().includes(needle);
  });

  const totalPages = count ? Math.ceil(count / pageSize) : 1;
  const baseParams = {
    q: searchParams.q,
    operator: searchParams.operator,
    match: matchMode === "or" ? "or" : undefined,
    product_match: productMatchMode === "or" ? "or" : undefined,
  };

  // Product master used to render the filter checkbox list.
  const productMaster = await fetchProducts(false);

  return (
    <section>
      <h1 className="text-2xl font-bold mb-4">録音一覧</h1>
      <form className="space-y-3 mb-4 text-sm bg-white rounded shadow p-4" action="/recordings">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="タイトル検索"
            className="px-3 py-2 border rounded"
          />
          <input
            name="operator"
            defaultValue={searchParams.operator ?? ""}
            placeholder="対応者メアド部分一致"
            className="px-3 py-2 border rounded"
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
            検索
          </button>
          {(successFilter.length > 0 || productFilter.length > 0) && (
            <Link href="/recordings" className="text-xs text-gray-500 hover:underline">
              フィルタをすべてクリア
            </Link>
          )}
        </div>

        <details open={successFilter.length > 0}>
          <summary className="cursor-pointer text-sm text-gray-700 hover:text-gray-900 select-none">
            提案成功で絞り込み（複数選択可）
            {successFilter.length > 0 && (
              <span className="ml-2 text-xs text-blue-600">
                {successFilter.length}項目選択中（{matchMode === "or" ? "OR" : "AND"}）
              </span>
            )}
          </summary>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="text-gray-600">マッチ条件:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="match"
                value="and"
                defaultChecked={matchMode === "and"}
                className="accent-blue-600"
              />
              <span>AND（全部成功）</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="match"
                value="or"
                defaultChecked={matchMode === "or"}
                className="accent-blue-600"
              />
              <span>OR（いずれか成功）</span>
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {PROPOSAL_ITEMS.map((item) => {
              const checked = successFilter.includes(item.key);
              return (
                <label
                  key={item.key}
                  className={`flex items-center gap-1.5 px-2 py-1 border rounded cursor-pointer text-xs ${
                    checked
                      ? "bg-green-100 border-green-300 text-green-800"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="success"
                    value={item.key}
                    defaultChecked={checked}
                    className="accent-green-600"
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>
        </details>

        <details open={productFilter.length > 0}>
          <summary className="cursor-pointer text-sm text-gray-700 hover:text-gray-900 select-none">
            商品で絞り込み（複数選択可）
            {productFilter.length > 0 && (
              <span className="ml-2 text-xs text-blue-600">
                {productFilter.length}項目選択中（{productMatchMode === "or" ? "OR" : "AND"}）
              </span>
            )}
          </summary>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="text-gray-600">マッチ条件:</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="product_match"
                value="and"
                defaultChecked={productMatchMode === "and"}
                className="accent-blue-600"
              />
              <span>AND（全部含む）</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="product_match"
                value="or"
                defaultChecked={productMatchMode === "or"}
                className="accent-blue-600"
              />
              <span>OR（いずれか含む）</span>
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {productMaster.map((p) => {
              const checked = productFilter.includes(p.name);
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-1.5 px-2 py-1 border rounded cursor-pointer text-xs ${
                    checked
                      ? "bg-blue-100 border-blue-300 text-blue-800"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="product"
                    value={p.name}
                    defaultChecked={checked}
                    className="accent-blue-600"
                  />
                  <span>{p.name}</span>
                </label>
              );
            })}
            {productMaster.length === 0 && (
              <p className="col-span-full text-xs text-gray-500">
                商品マスターが空です。/products から商品を追加してください。
              </p>
            )}
          </div>
        </details>
      </form>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-3 py-2">録音日時</th>
              <th className="px-3 py-2">録音時間</th>
              <th className="px-3 py-2">セッションID</th>
              <th className="px-3 py-2">対応者</th>
              <th className="px-3 py-2">タイトル</th>
              <th className="px-3 py-2">商品</th>
              <th className="px-3 py-2">内容</th>
              <th className="px-3 py-2">提案成功</th>
              <th className="px-3 py-2">ステータス</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r: Recording) => {
              const transcript = r.transcripts?.[0];
              const successKeys = Array.from(proposalsBySession.get(r.session_id) ?? []);
              return (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(r.started_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDuration(r.duration_sec)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.session_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2" title={r.operator_email ?? ""}>
                    {operatorDisplayName(r.operator_email, byEmail)}
                  </td>
                  <td className="px-3 py-2">{transcript?.title ?? "-"}</td>
                  <td className="px-3 py-2">
                    {(transcript?.products ?? []).length === 0 ? (
                      <span className="text-gray-300 text-xs">-</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(transcript?.products ?? []).map((name) => (
                          <Link
                            key={name}
                            href={buildHref(
                              "/recordings",
                              { product_match: "or" },
                              [],
                              [name]
                            )}
                            className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200"
                          >
                            {name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-md">{truncate(transcript?.summary, 60)}</td>
                  <td className="px-3 py-2">
                    {successKeys.length === 0 ? (
                      <span className="text-gray-300 text-xs">-</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {successKeys.map((key) => (
                          <span
                            key={key}
                            className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-300"
                          >
                            {PROPOSAL_LABEL_BY_KEY.get(key) ?? key}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                  該当する録音がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span>
          {count ?? 0} 件中 {from + 1}-{Math.min(to + 1, count ?? 0)}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={buildHref("/recordings", { ...baseParams, page: String(page - 1) }, successFilter, productFilter)}
              className="px-3 py-1 border rounded"
            >
              前へ
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={buildHref("/recordings", { ...baseParams, page: String(page + 1) }, successFilter, productFilter)}
              className="px-3 py-1 border rounded"
            >
              次へ
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function renderEmpty(
  searchParams: { q?: string; operator?: string },
  successFilter: string[],
  matchMode: "and" | "or"
) {
  return (
    <section>
      <h1 className="text-2xl font-bold mb-4">録音一覧</h1>
      <p className="text-sm text-gray-600 mb-4">
        指定された絞り込み条件に一致する録音は見つかりませんでした。
      </p>
      <Link
        href={buildHref("/recordings", { q: searchParams.q, operator: searchParams.operator }, [])}
        className="text-blue-600 hover:underline text-sm"
      >
        フィルタをクリア
      </Link>
      <p className="text-xs text-gray-500 mt-2">
        絞り込み中（{matchMode === "or" ? "OR" : "AND"}）: {successFilter.join(", ")}
      </p>
    </section>
  );
}
