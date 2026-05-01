import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { PromptForm, type SavePromptState } from "./prompt-form";

export const dynamic = "force-dynamic";

async function savePrompt(
  _prev: SavePromptState,
  formData: FormData,
): Promise<SavePromptState> {
  "use server";
  try {
    const user = await requireAdmin();
    const body = String(formData.get("body") ?? "").trim();
    if (!body) {
      return { ok: false, message: "本文が空です", ts: Date.now() };
    }
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
      return {
        ok: false,
        message: error.message,
        ts: Date.now(),
      };
    }
    revalidatePath("/prompt");
    return { ok: true, message: "保存しました", ts: Date.now() };
  } catch (exc) {
    return {
      ok: false,
      message: exc instanceof Error ? exc.message : String(exc),
      ts: Date.now(),
    };
  }
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

  const meta = `最終更新: ${
    data?.updated_at
      ? new Date(data.updated_at).toLocaleString("ja-JP", {
          hour12: false,
          timeZone: "Asia/Tokyo",
        })
      : "-"
  }${data?.updated_by_email ? `（${data.updated_by_email}）` : ""}`;

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

      <PromptForm
        defaultBody={data?.body ?? ""}
        meta={meta}
        action={savePrompt}
      />
    </section>
  );
}
