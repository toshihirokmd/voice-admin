import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type UserRole = {
  email: string;
  display_name: string | null;
  role: "admin" | "operator";
  created_at: string;
};

async function updateUser(formData: FormData) {
  "use server";
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "");
  if (!email || (role !== "admin" && role !== "operator")) return;
  const supabase = createClient();
  await supabase
    .from("user_roles")
    .update({ display_name: displayName, role })
    .eq("email", email);
  revalidatePath("/users");
}

export default async function UsersPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("email,display_name,role,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return <p className="text-red-600">エラー: {error.message}</p>;
  }
  const users = (data ?? []) as UserRole[];

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ユーザー管理</h1>
        <p className="text-sm text-gray-600 mt-1">
          表示名（録音一覧の「対応者」列）とロールを編集できます。新規ユーザーは初回ログイン時に自動でoperatorとして登録されます。
        </p>
      </div>

      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-3 py-2">メールアドレス</th>
              <th className="px-3 py-2">表示名</th>
              <th className="px-3 py-2">ロール</th>
              <th className="px-3 py-2">登録日</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{u.email}</td>
                <td className="px-3 py-2">
                  <form action={updateUser} className="flex gap-2 items-center">
                    <input type="hidden" name="email" value={u.email} />
                    <input
                      name="display_name"
                      defaultValue={u.display_name ?? ""}
                      className="border rounded px-2 py-1 text-sm"
                      placeholder="例: 山田太郎"
                    />
                    <select name="role" defaultValue={u.role} className="border rounded px-2 py-1 text-sm">
                      <option value="operator">operator</option>
                      <option value="admin">admin</option>
                    </select>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    >
                      保存
                    </button>
                  </form>
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-200">{u.role}</span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {new Date(u.created_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                </td>
                <td className="px-3 py-2"></td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                  ユーザーがまだ登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
