import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { UploadForm } from "./upload-form";
import { AutoRefresh } from "./auto-refresh";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  processing: { label: "処理中", cls: "bg-brand-soft text-brand-sub" },
  transcribed: { label: "完了", cls: "bg-brand-soft text-brand-green" },
  failed: { label: "失敗", cls: "bg-brand-ssoft text-brand-sakura" },
};

// 通話日は「日付」の情報なので時刻は出さない（時刻を出すと 0:00/9:00 が並んで紛らわしい）。
function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

type Row = {
  id: string;
  started_at: string | null;
  status: string;
  note: string | null;
  operator_email: string | null;
  transcripts: { title: string | null }[] | null;
};

export default async function UploadsPage() {
  // 管理者だけでなくオペレーターも利用できる（一覧は全員分を共有）。
  await requireUser();
  const svc = createServiceClient();
  const { data } = await svc
    .from("recordings")
    .select("id, started_at, status, note, operator_email, transcripts(title)")
    .eq("source", "upload")
    .order("started_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as Row[];
  const hasProcessing = rows.some((r) => r.status === "processing");

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <AutoRefresh active={hasProcessing} />
      <header>
        <p className="text-xs font-bold text-brand-leaf tracking-widest">UPLOAD</p>
        <h1 className="text-3xl font-extrabold text-brand-green">アップロード書き起こし</h1>
        <div className="mt-1 h-1 w-12 rounded-full bg-brand-sakura" />
        <p className="mt-3 text-xs text-brand-sub leading-relaxed">
          録音ファイルをアップロードすると、通常の通話と同じAIで書き起こし・要約します。
          話者（オペレーター／お客様）は会話内容から推測するため、拡張機能の録音より精度は控えめです。
        </p>
      </header>

      <UploadForm />

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-brand-green">アップロード一覧</h2>
        <div className="bg-white border border-brand-border rounded-card shadow-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-soft text-brand-sub text-left">
              <tr>
                <th className="py-3 px-3 font-bold whitespace-nowrap">通話日</th>
                <th className="py-3 px-3 font-bold">タイトル</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">担当</th>
                <th className="py-3 px-3 font-bold">メモ</th>
                <th className="py-3 px-3 font-bold whitespace-nowrap">状態</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 px-3 text-center text-brand-sub text-xs">
                    まだアップロードはありません
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const st = STATUS[r.status] ?? { label: r.status, cls: "bg-brand-soft text-brand-sub" };
                const title = r.transcripts?.[0]?.title ?? "（書き起こし前）";
                return (
                  <tr key={r.id} className="border-t border-brand-border hover:bg-brand-soft/50 align-top">
                    <td className="py-3.5 px-3 text-xs text-brand-sub whitespace-nowrap">{fmt(r.started_at)}</td>
                    <td className="py-3.5 px-3">
                      <Link href={`/uploads/${r.id}`} className="font-bold text-brand-green hover:underline">
                        {title}
                      </Link>
                    </td>
                    <td className="py-3.5 px-3 text-xs text-brand-sub whitespace-nowrap">
                      {r.operator_email?.split("@")[0] ?? "-"}
                    </td>
                    <td className="py-3.5 px-3 text-xs text-brand-sub">{r.note ?? ""}</td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
