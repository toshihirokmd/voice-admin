import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionResult } from "@/lib/forms/stateful-save-button";
import { UserRow } from "./user-row";

export const dynamic = "force-dynamic";

type UserRole = {
  email: string;
  display_name: string | null;
  role: "admin" | "operator";
  created_at: string;
};

async function updateUser(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  "use server";
  try {
    await requireAdmin();
    const email = String(formData.get("email") ?? "").trim();
    const displayName = String(formData.get("display_name") ?? "").trim() || null;
    const role = String(formData.get("role") ?? "");
    if (!email) {
      return { ok: false, message: "メールアドレスが無効です", ts: Date.now() };
    }
    if (role !== "admin" && role !== "operator") {
      return { ok: false, message: "ロールが無効です", ts: Date.now() };
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("user_roles")
      .update({ display_name: displayName, role })
      .eq("email", email);
    if (error) {
      return { ok: false, message: error.message, ts: Date.now() };
    }
    revalidatePath("/users");
    return { ok: true, message: "保存しました", ts: Date.now() };
  } catch (exc) {
    return {
      ok: false,
      message: exc instanceof Error ? exc.message : String(exc),
      ts: Date.now(),
    };
  }
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
              <UserRow key={u.email} user={u} action={updateUser} />
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
