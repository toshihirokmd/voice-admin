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
    return <p className="text-brand-sakura">エラー: {error.message}</p>;
  }
  const users = (data ?? []) as UserRole[];

  return (
    <section className="space-y-6">
      <header>
        <div className="text-xs font-bold text-brand-leaf tracking-widest">
          USERS
        </div>
        <h1 className="text-3xl font-extrabold text-brand-green">
          ユーザー管理
        </h1>
        <div className="mt-1 h-1 w-12 rounded-full bg-brand-sakura" />
        <p className="text-sm text-brand-sub mt-2">
          表示名（録音一覧の「対応者」列）とロールを編集できます。新規ユーザーは初回ログイン時に自動でoperatorとして登録されます。
        </p>
      </header>

      <div className="bg-white border border-brand-border rounded-card shadow-soft overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
            👥
          </span>
          <h2 className="font-bold text-brand-green">登録ユーザー一覧</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-brand-soft text-left text-brand-sub">
            <tr>
              <th className="py-3.5 px-3">メールアドレス</th>
              <th className="py-3.5 px-3">表示名</th>
              <th className="py-3.5 px-3">ロール</th>
              <th className="py-3.5 px-3">登録日</th>
              <th className="py-3.5 px-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow key={u.email} user={u} action={updateUser} />
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 px-3 text-center text-brand-sub">
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
