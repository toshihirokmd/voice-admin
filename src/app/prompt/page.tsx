import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function savePrompt(formData: FormData) {
  "use server";
  const user = await requireAdmin();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const supabase = createClient();
  const { error } = await supabase
    .from("active_prompt")
    .update({
      body,
      updated_by_email: user.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) {
    throw new Error(`保存に失敗しました: ${error.message}`);
  }
  revalidatePath("/prompt");
}

export default async function PromptPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("active_prompt")
    .select("body,updated_at,updated_by_email")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return <p className="text-red-600">エラー: {error.message}</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">プロンプト編集</h1>
        <p className="text-sm text-gray-600 mt-1">
          Geminiに渡すプロンプト本文を編集します。保存すると次の録音から即座に新プロンプトが使われます。
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
        <p className="font-semibold mb-1">プレースホルダ</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>
            <code className="bg-white px-1 py-0.5 rounded">{"{{PRODUCT_DICTIONARY}}"}</code>:
            Native Hostが自動で商品辞書(products.json)に置換します。
          </li>
          <li>
            <code className="bg-white px-1 py-0.5 rounded">{"{{CHUNK_INDEX}}"}</code>:
            分割転写時のチャンク番号(1, 2, ...)に置換されます。
          </li>
        </ul>
      </div>

      <form action={savePrompt} className="bg-white rounded shadow p-4 space-y-3">
        <textarea
          name="body"
          defaultValue={data?.body ?? ""}
          rows={30}
          className="w-full font-mono text-sm border rounded p-3"
          required
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            最終更新: {data?.updated_at ? new Date(data.updated_at).toLocaleString("ja-JP") : "-"}{" "}
            {data?.updated_by_email && `（${data.updated_by_email}）`}
          </p>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </form>
    </section>
  );
}
