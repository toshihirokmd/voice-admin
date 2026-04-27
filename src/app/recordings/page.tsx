import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

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
  }>;
};

type UserRoleRow = {
  email: string;
  display_name: string | null;
};

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

export default async function RecordingsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; operator?: string };
}) {
  await requireAdmin();
  const supabase = createClient();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("recordings")
    .select(
      "id,session_id,started_at,ended_at,duration_sec,operator_email,status,transcripts(title,summary,merged_text)",
      { count: "exact" }
    )
    .order("started_at", { ascending: false })
    .range(from, to);

  if (searchParams.operator) {
    query = query.ilike("operator_email", `%${searchParams.operator}%`);
  }

  const { data: recordings, count, error } = await query;
  if (error) {
    return <p className="text-red-600">エラー: {error.message}</p>;
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

  return (
    <section>
      <h1 className="text-2xl font-bold mb-4">録音一覧</h1>
      <form className="flex gap-3 mb-4 text-sm" action="/recordings">
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
              <th className="px-3 py-2">内容</th>
              <th className="px-3 py-2">ステータス</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r: Recording) => {
              const transcript = r.transcripts?.[0];
              return (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(r.started_at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDuration(r.duration_sec)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.session_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2" title={r.operator_email ?? ""}>
                    {operatorDisplayName(r.operator_email, byEmail)}
                  </td>
                  <td className="px-3 py-2">{transcript?.title ?? "-"}</td>
                  <td className="px-3 py-2 max-w-md">{truncate(transcript?.summary, 60)}</td>
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
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
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
              href={`/recordings?${new URLSearchParams({
                ...(searchParams.q ? { q: searchParams.q } : {}),
                ...(searchParams.operator ? { operator: searchParams.operator } : {}),
                page: String(page - 1),
              }).toString()}`}
              className="px-3 py-1 border rounded"
            >
              前へ
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/recordings?${new URLSearchParams({
                ...(searchParams.q ? { q: searchParams.q } : {}),
                ...(searchParams.operator ? { operator: searchParams.operator } : {}),
                page: String(page + 1),
              }).toString()}`}
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
