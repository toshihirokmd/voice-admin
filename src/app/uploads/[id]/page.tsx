import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { RetryButton } from "../retry-button";

export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ja-JP", { hour12: false, timeZone: "Asia/Tokyo" });
}

export default async function UploadDetailPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const svc = createServiceClient();

  const { data: rec } = await svc
    .from("recordings")
    .select("id, started_at, status, note, source, operator_email")
    .eq("id", params.id)
    .maybeSingle();

  if (!rec || rec.source !== "upload") {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link href="/uploads" className="text-sm text-emerald-700 underline">← 一覧へ</Link>
        <p className="mt-4 text-gray-500">見つかりません。</p>
      </main>
    );
  }

  const { data: tx } = await svc
    .from("transcripts")
    .select("title, summary, merged_text, tags, products")
    .eq("recording_id", params.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <Link href="/uploads" className="text-sm text-emerald-700 underline">← 一覧へ</Link>
      <h1 className="text-xl font-bold">{tx?.title ?? "（書き起こし前）"}</h1>
      <div className="text-sm text-gray-600">
        通話日: {fmt(rec.started_at)} ／ 状態: {rec.status} ／ 担当: {rec.operator_email ?? "-"}
        {rec.note ? ` ／ メモ: ${rec.note}` : ""}
      </div>

      {rec.status === "processing" && (
        <p className="text-amber-700">処理中です。少し待ってから再読み込みしてください。</p>
      )}
      {rec.status === "failed" && (
        <div className="space-y-2">
          <p className="text-red-600">書き起こしに失敗しました。</p>
          <RetryButton recordingId={rec.id} />
        </div>
      )}

      {tx && (
        <>
          <section>
            <h2 className="mb-1 font-semibold">要約</h2>
            <pre className="whitespace-pre-wrap rounded border bg-gray-50 p-3 text-sm">{tx.summary}</pre>
          </section>
          {Array.isArray(tx.products) && tx.products.length > 0 && (
            <p className="text-sm">商品: {tx.products.join(", ")}</p>
          )}
          <section>
            <h2 className="mb-1 font-semibold">全文書き起こし</h2>
            <pre className="whitespace-pre-wrap rounded border bg-gray-50 p-3 text-sm">{tx.merged_text}</pre>
          </section>
        </>
      )}
    </main>
  );
}
