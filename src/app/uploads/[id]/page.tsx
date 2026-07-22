import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { RetryButton } from "../retry-button";
import { CopyButton } from "../copy-button";

export const dynamic = "force-dynamic";

// 通話日は「日付」の情報なので時刻は出さない（一覧と表示を揃える）。
function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

const STATUS_LABEL: Record<string, string> = {
  processing: "処理中",
  transcribed: "完了",
  failed: "失敗",
};

export default async function UploadDetailPage({ params }: { params: { id: string } }) {
  // 管理者だけでなくオペレーターも閲覧できる。
  await requireUser();
  const svc = createServiceClient();

  const { data: rec } = await svc
    .from("recordings")
    .select("id, started_at, status, note, source, operator_email")
    .eq("id", params.id)
    .maybeSingle();

  if (!rec || rec.source !== "upload") {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link href="/uploads" className="text-xs font-bold text-brand-green hover:underline">
          ← 一覧へ
        </Link>
        <p className="mt-6 text-sm text-brand-sub">見つかりません。</p>
      </main>
    );
  }

  const { data: tx } = await svc
    .from("transcripts")
    .select("title, summary, merged_text, tags, products")
    .eq("recording_id", params.id)
    .maybeSingle();

  const summary = tx?.summary ?? "";
  const merged = tx?.merged_text ?? "";
  // 要約＋全文をまとめて1回でコピーできるようにする（報告用に貼りやすい）。
  const whole = [
    tx?.title ? `# ${tx.title}` : "",
    `通話日: ${fmt(rec.started_at)} / 担当: ${rec.operator_email ?? "-"}`,
    rec.note ? `メモ: ${rec.note}` : "",
    "",
    "===== 要約 =====",
    summary,
    "",
    "===== 全文書き起こし =====",
    merged,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 space-y-5">
      <Link href="/uploads" className="text-xs font-bold text-brand-green hover:underline">
        ← 一覧へ
      </Link>

      <header>
        <p className="text-xs font-bold text-brand-leaf tracking-widest">UPLOAD</p>
        <h1 className="text-2xl font-extrabold text-brand-green leading-snug">
          {tx?.title ?? "（書き起こし前）"}
        </h1>
        <div className="mt-1 h-1 w-12 rounded-full bg-brand-sakura" />
        <p className="mt-3 text-xs text-brand-sub">
          通話日: {fmt(rec.started_at)} ／ 状態: {STATUS_LABEL[rec.status] ?? rec.status} ／ 担当:{" "}
          {rec.operator_email ?? "-"}
          {rec.note ? ` ／ メモ: ${rec.note}` : ""}
        </p>
        {tx && (
          <div className="mt-3">
            <CopyButton text={whole} label="全体をコピー" />
          </div>
        )}
      </header>

      {rec.status === "processing" && (
        <div className="bg-brand-soft border border-brand-border rounded-card p-4 text-sm text-brand-sub">
          処理中です。少し待ってから再読み込みしてください。
        </div>
      )}
      {rec.status === "failed" && (
        <div className="bg-brand-ssoft border border-brand-border rounded-card p-4 space-y-2">
          <p className="text-sm font-bold text-brand-sakura">書き起こしに失敗しました。</p>
          <RetryButton recordingId={rec.id} />
        </div>
      )}

      {tx && (
        <>
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-brand-green">要約</h2>
              <CopyButton text={summary} label="要約をコピー" />
            </div>
            <div className="bg-white border border-brand-border rounded-card shadow-soft p-5">
              <pre className="whitespace-pre-wrap text-sm text-brand-ink leading-relaxed font-sans">
                {summary}
              </pre>
            </div>
          </section>

          {Array.isArray(tx.products) && tx.products.length > 0 && (
            <p className="text-xs text-brand-sub">
              商品:{" "}
              {tx.products.map((p: string) => (
                <span
                  key={p}
                  className="inline-block mr-1.5 text-xs px-2 py-0.5 rounded-full font-bold bg-brand-soft text-brand-green"
                >
                  {p}
                </span>
              ))}
            </p>
          )}

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-brand-green">全文書き起こし</h2>
              <CopyButton text={merged} label="全文をコピー" />
            </div>
            <div className="bg-white border border-brand-border rounded-card shadow-soft p-5">
              <pre className="whitespace-pre-wrap text-sm text-brand-ink leading-relaxed font-sans">
                {merged}
              </pre>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
