import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { PROPOSAL_ITEMS, valueLabel } from "@/lib/proposal/items";

export const dynamic = "force-dynamic";

type RecordingDetail = {
  id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  operator_email: string | null;
  status: string;
  customer_id: string | null;
  source_url: string | null;
  mic_path: string | null;
  speaker_path: string | null;
  transcripts: Array<{
    title: string | null;
    summary: string | null;
    merged_text: string | null;
    tags: string[] | null;
    products: string[] | null;
    tokens_in: number | null;
    tokens_out: number | null;
  }>;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ja-JP", { hour12: false, timeZone: "Asia/Tokyo" });
}

function formatDuration(sec: number | null): string {
  if (sec == null) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default async function RecordingDetailPage({
  params,
}: {
  params: { sessionId: string };
}) {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recordings")
    .select(
      "id,session_id,started_at,ended_at,duration_sec,operator_email,status,customer_id,source_url,mic_path,speaker_path,transcripts(title,summary,merged_text,tags,products,tokens_in,tokens_out)"
    )
    .eq("session_id", params.sessionId)
    .maybeSingle<RecordingDetail>();

  if (error) {
    return <p className="text-red-600">エラー: {error.message}</p>;
  }
  if (!data) notFound();

  const t = data.transcripts?.[0];

  const { data: proposalsData } = await supabase
    .from("proposals")
    .select("id,items,proposed_at")
    .eq("session_id", params.sessionId)
    .order("proposed_at", { ascending: false });
  const proposals = (proposalsData ?? []) as Array<{
    id: string;
    items: Record<string, unknown>;
    proposed_at: string;
  }>;

  const { data: linkedOrdersData } = await supabase
    .from("recording_orders")
    .select(
      "id,order_number,status_code,status_label,total_amount,payment_method,recipient_name,shipping_date,delivery_date,next_delivery_date,product_names,product_groups,selected_at"
    )
    .eq("session_id", params.sessionId)
    .order("selected_at", { ascending: false });
  const linkedOrders = (linkedOrdersData ?? []) as Array<{
    id: string;
    order_number: string | null;
    status_code: number | null;
    status_label: string | null;
    total_amount: string | null;
    payment_method: string | null;
    recipient_name: string | null;
    shipping_date: string | null;
    delivery_date: string | null;
    next_delivery_date: string | null;
    product_names: string[] | null;
    product_groups: string[] | null;
    selected_at: string;
  }>;
  let displayName = data.operator_email ?? "未設定";
  if (data.operator_email) {
    const { data: role } = await supabase
      .from("user_roles")
      .select("display_name")
      .eq("email", data.operator_email)
      .maybeSingle();
    if (role?.display_name) displayName = role.display_name;
    else displayName = data.operator_email.split("@")[0];
  }

  return (
    <article className="space-y-6">
      <div>
        <Link href="/recordings" className="text-sm text-blue-600 hover:underline">
          ← 一覧に戻る
        </Link>
        <h1 className="text-2xl font-bold mt-2">{t?.title ?? "(タイトルなし)"}</h1>
        {(t?.products ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-gray-500">言及された商品:</span>
            {(t?.products ?? []).map((name) => (
              <Link
                key={name}
                href={`/recordings?${new URLSearchParams({ product: name, product_match: "or" }).toString()}`}
                className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-200"
              >
                {name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <section className="bg-white rounded shadow p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <Field label="録音日時" value={formatDateTime(data.started_at)} />
        <Field label="録音時間" value={formatDuration(data.duration_sec)} />
        <Field label="ステータス" value={data.status} />
        <Field label="対応者" value={displayName} />
        <Field label="対応者メアド" value={data.operator_email ?? "-"} />
        <Field label="顧客ID" value={data.customer_id ?? "-"} />
        <Field label="セッションID" value={data.session_id} mono />
        <Field label="トークン入" value={t?.tokens_in?.toString() ?? "-"} />
        <Field label="トークン出" value={t?.tokens_out?.toString() ?? "-"} />
      </section>

      <section className="bg-white rounded shadow p-4">
        <h2 className="font-semibold mb-2">音声ダウンロード</h2>
        <div className="flex flex-wrap gap-3 items-center">
          {data.mic_path && data.speaker_path ? (
            <>
              <a
                href={`/api/download/${data.session_id}?track=mixed`}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
              >
                通話音声をダウンロード（統合）
              </a>
              <details className="text-sm text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700">個別トラックも必要な場合</summary>
                <div className="mt-2 flex gap-2">
                  <a
                    href={`/api/download/${data.session_id}?track=mic`}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
                  >
                    オペレーター音声のみ
                  </a>
                  <a
                    href={`/api/download/${data.session_id}?track=speaker`}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
                  >
                    お客様音声のみ
                  </a>
                </div>
              </details>
            </>
          ) : (
            <p className="text-sm text-gray-500">音声ファイルはまだ保存されていません。</p>
          )}
        </div>
      </section>

      <section className="bg-white rounded shadow p-4">
        <h2 className="font-semibold mb-2">要約</h2>
        <pre className="whitespace-pre-wrap text-sm">{t?.summary ?? "-"}</pre>
      </section>

      <section className="bg-white rounded shadow p-4">
        <h2 className="font-semibold mb-2">タグ</h2>
        <div className="flex flex-wrap gap-2">
          {(t?.tags ?? []).map((tag) => (
            <span key={tag} className="px-2 py-0.5 text-xs bg-gray-200 rounded">
              {tag}
            </span>
          ))}
          {(!t?.tags || t.tags.length === 0) && <span className="text-sm text-gray-500">-</span>}
        </div>
      </section>

      <section className="bg-white rounded shadow p-4">
        <h2 className="font-semibold mb-2">提案結果</h2>
        {proposals.length === 0 ? (
          <p className="text-sm text-gray-500">この録音にひもづく提案結果はまだありません。</p>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal) => (
              <div key={proposal.id} className="border rounded p-3">
                <div className="text-xs text-gray-500 mb-2">
                  {new Date(proposal.proposed_at).toLocaleString("ja-JP", { hour12: false, timeZone: "Asia/Tokyo" })}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {PROPOSAL_ITEMS.map((item) => {
                    const v = valueLabel(proposal.items[item.key]);
                    return (
                      <div
                        key={item.key}
                        className={`flex items-center justify-between border rounded px-2 py-1 text-xs ${v.cls}`}
                      >
                        <span className="truncate">{item.label}</span>
                        <span className="font-semibold ml-2">{v.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded shadow p-4">
        <h2 className="font-semibold mb-2">紐付け受注</h2>
        {linkedOrders.length === 0 ? (
          <p className="text-sm text-gray-500">この録音にひもづく受注はまだ登録されていません。</p>
        ) : (
          <div className="space-y-3">
            {linkedOrders.map((order) => {
              const groups = order.product_groups ?? [];
              const names = order.product_names ?? [];
              const meta: string[] = [];
              if (order.total_amount) meta.push(order.total_amount);
              if (order.payment_method) meta.push(order.payment_method);
              if (order.recipient_name) meta.push(order.recipient_name);
              return (
                <div key={order.id} className="border rounded p-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold text-sm">
                      {order.order_number ? `受注 ${order.order_number}` : "受注 (番号不明)"}
                    </span>
                    {(order.status_code !== null || order.status_label) && (
                      <span className="text-xs text-gray-600">
                        {order.status_code !== null ? `${order.status_code}: ` : ""}
                        {order.status_label ?? ""}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-gray-400">
                      登録 {formatDateTime(order.selected_at)}
                    </span>
                  </div>
                  {groups.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs text-gray-500">商品グループ:</span>
                      {groups.map((g) => (
                        <span
                          key={g}
                          className={`text-xs px-2 py-0.5 rounded border ${g === "未分類" ? "bg-gray-100 text-gray-600 border-gray-300" : "bg-emerald-100 text-emerald-800 border-emerald-300"}`}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                  {names.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      商品: {names.join(" / ")}
                    </div>
                  )}
                  {meta.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">{meta.join(" / ")}</div>
                  )}
                  <div className="mt-1 text-xs text-gray-500">
                    {order.shipping_date && <span>出荷予定 {order.shipping_date} / </span>}
                    {order.delivery_date && <span>配達 {order.delivery_date} / </span>}
                    {order.next_delivery_date && <span>次回 {order.next_delivery_date}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bg-white rounded shadow p-4">
        <h2 className="font-semibold mb-2">本文（書き起こし）</h2>
        <pre className="whitespace-pre-wrap text-sm">{t?.merged_text ?? "-"}</pre>
      </section>
    </article>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={mono ? "font-mono text-xs break-all" : ""}>{value}</div>
    </div>
  );
}
