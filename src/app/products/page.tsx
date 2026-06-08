import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchProducts } from "@/lib/products/queries";
import { ActionResult } from "@/lib/forms/stateful-save-button";
import { AddProductForm, ProductRow } from "./product-forms";

export const dynamic = "force-dynamic";

async function addProduct(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  "use server";
  try {
    await requireAdmin();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, message: "商品名は必須です", ts: Date.now() };
    const kana = String(formData.get("kana") ?? "").trim() || null;
    const sortOrderRaw = String(formData.get("sort_order") ?? "").trim();
    const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 100;
    const supabase = createClient();
    const { error } = await supabase.from("products").insert({
      name,
      kana,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 100,
      is_active: true,
    });
    if (error) {
      return { ok: false, message: error.message, ts: Date.now() };
    }
    revalidatePath("/products");
    return { ok: true, message: "追加しました", ts: Date.now() };
  } catch (exc) {
    return {
      ok: false,
      message: exc instanceof Error ? exc.message : String(exc),
      ts: Date.now(),
    };
  }
}

async function updateProduct(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  "use server";
  try {
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false, message: "ID が無効です", ts: Date.now() };
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, message: "商品名は必須です", ts: Date.now() };
    const kana = String(formData.get("kana") ?? "").trim() || null;
    const sortOrderRaw = String(formData.get("sort_order") ?? "").trim();
    const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 100;
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({
        name,
        kana,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 100,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      return { ok: false, message: error.message, ts: Date.now() };
    }
    revalidatePath("/products");
    return { ok: true, message: "保存しました", ts: Date.now() };
  } catch (exc) {
    return {
      ok: false,
      message: exc instanceof Error ? exc.message : String(exc),
      ts: Date.now(),
    };
  }
}

async function toggleActive(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  "use server";
  try {
    await requireAdmin();
    const id = String(formData.get("id") ?? "").trim();
    const next = formData.get("next") === "true";
    if (!id) return { ok: false, message: "ID が無効です", ts: Date.now() };
    const supabase = createClient();
    const { error } = await supabase
      .from("products")
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      return { ok: false, message: error.message, ts: Date.now() };
    }
    revalidatePath("/products");
    return {
      ok: true,
      message: next ? "有効化しました" : "無効化しました",
      ts: Date.now(),
    };
  } catch (exc) {
    return {
      ok: false,
      message: exc instanceof Error ? exc.message : String(exc),
      ts: Date.now(),
    };
  }
}

export default async function ProductsPage() {
  await requireAdmin();
  const products = await fetchProducts(true);

  return (
    <section className="space-y-6">
      <header>
        <div className="text-xs font-bold text-brand-leaf tracking-widest">
          PRODUCTS
        </div>
        <h1 className="text-3xl font-extrabold text-brand-green">
          商品マスター
        </h1>
        <div className="mt-1 h-1 w-12 rounded-full bg-brand-sakura" />
        <p className="text-sm text-brand-sub mt-2">
          書き起こし時にGeminiが参照する商品辞書を管理します。表記をここで揃えると、録音の「商品」列にもこの正式表記で記録されます。
        </p>
      </header>

      <AddProductForm action={addProduct} />

      <div className="bg-white border border-brand-border rounded-card shadow-soft overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-brand-soft text-xs text-brand-sub font-bold">
          <div className="col-span-4">商品名</div>
          <div className="col-span-3">かな</div>
          <div className="col-span-1">並び順</div>
          <div className="col-span-1">状態</div>
          <div className="col-span-3 text-right">操作</div>
        </div>
        <div className="divide-y divide-brand-border">
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              updateAction={updateProduct}
              toggleAction={toggleActive}
            />
          ))}
        </div>
        {products.length === 0 && (
          <div className="px-4 py-8 text-center text-brand-sub text-sm">
            商品がまだ登録されていません
          </div>
        )}
      </div>

      <p className="text-xs text-brand-sub">
        ※ 無効化した商品はGeminiの辞書から外れます。過去の録音に記録された商品名はそのまま残ります。
      </p>
    </section>
  );
}
