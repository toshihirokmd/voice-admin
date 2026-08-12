import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { PROPOSAL_ITEMS, valueLabel } from "@/lib/proposal/items";
import { renderEvaluation, type Evaluation } from "@/lib/evaluation";

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
    evaluation: Evaluation | null;
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

/**
 * 1通話に提案登録が複数あっても、表としては1枚にまとめる。
 * 各項目は「成功(1) > 提案のみ(0) > 未選択」の優先で1つの値に集約する。
 * （例: ある登録で「提案のみ」、別の登録で「成功」なら → 成功 を採用）
 */
function mergeProposalItems(
  proposals: Array<{ items: Record<string, unknown> }>
): Record<string, "0" | "1" | null> {
  const merged: Record<string, "0" | "1" | null> = {};
  for (const proposal of proposals) {
    for (const [key, raw] of Object.entries(proposal.items ?? {})) {
      const v: "0" | "1" | null = raw === "1" ? "1" : raw === "0" ? "0" : null;
      const cur = merged[key] ?? null;
      if (v === "1") merged[key] = "1";
      else if (v === "0" && cur !== "1") merged[key] = "0";
      else if (!(key in merged)) merged[key] = null;
    }
  }
  return merged;
}

export default async function RecordingDetailPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const user = await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recordings")
    .select(
      "id,session_id,started_at,ended_at,duration_sec,operator_email,status,customer_id,source_url,mic_path,speaker_path,transcripts(title,summary,merged_text,tags,products,tokens_in,tokens_out,evaluation)"
    )
    .eq("session_id", params.sessionId)
    .maybeSingle<RecordingDetail>();

  if (error) {
    return <p className="text-brand-sakura">エラー: {error.message}</p>;
  }
  if (!data) notFound();

  const t = data.transcripts?.[0];

  // chromeos版は音声を {session_id}/chunk_*.pcm 形式で保存する（旧 mic_path/speaker_path
  // は使わない）。meta.json の有無で音声ダウンロード可否を判定する。
  const { data: audioFiles } = await supabase.storage
    .from("voice-recordings")
    .list(params.sessionId, { limit: 1, search: "meta.json" });
  const hasAudio = (audioFiles ?? []).some((f) => f.name === "meta.json");

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
        <Link href="/recordings" className="text-sm text-brand-green hover:underline">
          ← 一覧に戻る
        </Link>
        <div className="text-xs font-bold text-brand-leaf tracking-widest mt-2">
          RECORDING
        </div>
        <h1 className="text-3xl font-extrabold text-brand-green">{t?.title ?? "(タイトルなし)"}</h1>
        <div className="mt-1 h-1 w-12 rounded-full bg-brand-sakura" />
        {(t?.products ?? []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-brand-sub">言及された商品:</span>
            {(t?.products ?? []).map((name) => (
              <Link
                key={name}
                href={`/recordings?${new URLSearchParams({ product: name, product_match: "or" }).toString()}`}
                className="text-xs px-2 py-0.5 rounded-full font-bold bg-brand-soft text-brand-green hover:bg-brand-leaf/25"
              >
                {name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
            📄
          </span>
          <h2 className="font-bold text-brand-green">録音情報</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <Field label="録音日時" value={formatDateTime(data.started_at)} />
        <Field label="録音時間" value={formatDuration(data.duration_sec)} />
        <Field label="ステータス" value={data.status} />
        <Field label="対応者" value={displayName} />
        <Field label="対応者メアド" value={data.operator_email ?? "-"} />
        <Field label="顧客ID" value={data.customer_id ?? "-"} />
        <Field label="セッションID" value={data.session_id} mono />
        <Field label="トークン入" value={t?.tokens_in?.toString() ?? "-"} />
        <Field label="トークン出" value={t?.tokens_out?.toString() ?? "-"} />
        </div>
      </section>

      <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
            🎧
          </span>
          <h2 className="font-bold text-brand-green">音声ダウンロード</h2>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          {hasAudio ? (
            <>
              <a
                href={`/api/download/${data.session_id}?track=mixed`}
                className="px-6 py-2.5 bg-brand-green text-white rounded-xl hover:bg-brand-dark font-bold transition"
              >
                通話音声をダウンロード（統合）
              </a>
              <details className="text-sm text-brand-sub">
                <summary className="cursor-pointer hover:text-brand-green">個別トラックも必要な場合</summary>
                <div className="mt-2 flex gap-2">
                  <a
                    href={`/api/download/${data.session_id}?track=mic`}
                    className="px-4 py-2 bg-white border border-brand-border text-brand-sub rounded-lg hover:bg-brand-soft text-xs"
                  >
                    オペレーター音声のみ
                  </a>
                  <a
                    href={`/api/download/${data.session_id}?track=speaker`}
                    className="px-4 py-2 bg-white border border-brand-border text-brand-sub rounded-lg hover:bg-brand-soft text-xs"
                  >
                    お客様音声のみ
                  </a>
                </div>
              </details>
            </>
          ) : (
            <p className="text-sm text-brand-sub">音声ファイルはまだ保存されていません。</p>
          )}
        </div>
      </section>

      <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
            📝
          </span>
          <h2 className="font-bold text-brand-green">要約</h2>
        </div>
        <pre className="whitespace-pre-wrap text-sm text-brand-ink">{t?.summary ?? "-"}</pre>
      </section>

      {user.role === "admin" && t?.evaluation && (
        <section className="bg-white border border-brand-border rounded-card shadow-soft p-5 space-y-2">
          <h2 className="text-sm font-bold text-brand-green">■ 応対の振り返り（管理者のみ）</h2>
          {renderEvaluation(t.evaluation).map((r) => (
            <p key={r.axis} className="text-sm text-brand-ink">
              ・{r.axis}：<b>{r.label}</b> ／ 根拠「{r.note}」
            </p>
          ))}
        </section>
      )}

      <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
            🏷️
          </span>
          <h2 className="font-bold text-brand-green">タグ</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {(t?.tags ?? []).map((tag) => (
            <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-brand-soft text-brand-green font-bold">
              {tag}
            </span>
          ))}
          {(!t?.tags || t.tags.length === 0) && <span className="text-sm text-brand-sub">-</span>}
        </div>
      </section>

      <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
            🎯
          </span>
          <h2 className="font-bold text-brand-green">提案結果</h2>
        </div>
        {proposals.length === 0 ? (
          <p className="text-sm text-brand-sub">この録音にひもづく提案結果はまだありません。</p>
        ) : (
          (() => {
            const mergedItems = mergeProposalItems(proposals);
            return (
              <div className="border border-brand-border rounded-lg p-3">
                {proposals.length > 1 && (
                  <div className="text-xs text-brand-sub mb-2">
                    提案登録 {proposals.length} 件をまとめて表示（
                    {proposals
                      .map((p) =>
                        new Date(p.proposed_at).toLocaleString("ja-JP", {
                          hour12: false,
                          timeZone: "Asia/Tokyo",
                        })
                      )
                      .join(" / ")}
                    ）
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {PROPOSAL_ITEMS.map((item) => {
                    const v = valueLabel(mergedItems[item.key]);
                    return (
                      <div
                        key={item.key}
                        className={`flex items-center justify-between border border-brand-border rounded-lg px-2 py-1 text-xs ${v.cls}`}
                      >
                        <span className="truncate">{item.label}</span>
                        <span className="font-semibold ml-2">{v.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()
        )}
      </section>

      <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
            📦
          </span>
          <h2 className="font-bold text-brand-green">紐付け受注</h2>
        </div>
        {linkedOrders.length === 0 ? (
          <p className="text-sm text-brand-sub">この録音にひもづく受注はまだ登録されていません。</p>
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
                <div key={order.id} className="border border-brand-border rounded-lg p-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-bold text-sm text-brand-ink">
                      {order.order_number ? `受注 ${order.order_number}` : "受注 (番号不明)"}
                    </span>
                    {(order.status_code !== null || order.status_label) && (
                      <span className="text-xs text-brand-sub">
                        {order.status_code !== null ? `${order.status_code}: ` : ""}
                        {order.status_label ?? ""}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-brand-sub">
                      登録 {formatDateTime(order.selected_at)}
                    </span>
                  </div>
                  {groups.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs text-brand-sub">商品グループ:</span>
                      {groups.map((g) => (
                        <span
                          key={g}
                          className={`text-xs px-2 py-0.5 rounded-full font-bold ${g === "未分類" ? "bg-brand-soft text-brand-sub" : "bg-brand-soft text-brand-green"}`}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                  {names.length > 0 && (
                    <div className="mt-1 text-xs text-brand-sub">
                      商品: {names.join(" / ")}
                    </div>
                  )}
                  {meta.length > 0 && (
                    <div className="mt-1 text-xs text-brand-sub">{meta.join(" / ")}</div>
                  )}
                  <div className="mt-1 text-xs text-brand-sub">
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

      <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
            💬
          </span>
          <h2 className="font-bold text-brand-green">本文（書き起こし）</h2>
        </div>
        <pre className="whitespace-pre-wrap text-sm text-brand-ink">{t?.merged_text ?? "-"}</pre>
      </section>
    </article>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-brand-sub">{label}</div>
      <div className={mono ? "font-mono text-xs break-all text-brand-ink" : "text-brand-ink"}>{value}</div>
    </div>
  );
}
