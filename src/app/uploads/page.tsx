import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  processing: { label: "処理中", cls: "bg-amber-100 text-amber-800" },
  transcribed: { label: "完了", cls: "bg-emerald-100 text-emerald-800" },
  failed: { label: "失敗", cls: "bg-red-100 text-red-800" },
};

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ja-JP", { hour12: false, timeZone: "Asia/Tokyo" });
}

type Row = {
  id: string;
  started_at: string | null;
  status: string;
  note: string | null;
  transcripts: { title: string | null }[] | null;
};

export default async function UploadsPage() {
  await requireAdmin();
  const svc = createServiceClient();
  const { data } = await svc
    .from("recordings")
    .select("id, started_at, status, note, transcripts(title)")
    .eq("source", "upload")
    .order("started_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as Row[];

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-xl font-bold">アップロード書き起こし</h1>
      <p className="text-sm text-gray-600">
        録音ファイルをアップロードすると、通常の通話と同じAIで書き起こし・要約します。
        話者（オペレーター／お客様）は会話内容から推測するため、拡張機能の録音より精度は控えめです。
      </p>

      <UploadForm />

      <section>
        <h2 className="mb-2 font-semibold">アップロード一覧</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">通話日</th>
              <th>タイトル</th>
              <th>メモ</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-gray-400">まだありません</td></tr>
            )}
            {rows.map((r) => {
              const st = STATUS[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-700" };
              const title = r.transcripts?.[0]?.title ?? "（書き起こし前）";
              return (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="py-2">{fmt(r.started_at)}</td>
                  <td>
                    <Link href={`/uploads/${r.id}`} className="text-emerald-700 underline">
                      {title}
                    </Link>
                  </td>
                  <td className="text-gray-600">{r.note ?? ""}</td>
                  <td>
                    <span className={`rounded px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
