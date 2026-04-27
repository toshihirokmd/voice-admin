import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchProducts } from "@/lib/products/queries";

export const dynamic = "force-dynamic";

async function addProduct(formData: FormData) {
  "use server";
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const kana = String(formData.get("kana") ?? "").trim() || null;
  const sortOrderRaw = String(formData.get("sort_order") ?? "").trim();
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 100;
  const supabase = createClient();
  await supabase.from("products").insert({
    name,
    kana,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 100,
    is_active: true,
  });
  revalidatePath("/products");
}

async function updateProduct(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const name = String(formData.get("name") ?? "").trim();
  const kana = String(formData.get("kana") ?? "").trim() || null;
  const sortOrderRaw = String(formData.get("sort_order") ?? "").trim();
  const sortOrder = sortOrderRaw ? parseInt(sortOrderRaw, 10) : 100;
  if (!name) return;
  const supabase = createClient();
  await supabase
    .from("products")
    .update({
      name,
      kana,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 100,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/products");
}

async function toggleActive(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const next = formData.get("next") === "true";
  if (!id) return;
  const supabase = createClient();
  await supabase
    .from("products")
    .update({ is_active: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/products");
}

export default async function ProductsPage() {
  await requireAdmin();
  const products = await fetchProducts(true);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">商品マスター</h1>
        <p className="text-sm text-gray-600 mt-1">
          書き起こし時にGeminiが参照する商品辞書を管理します。表記をここで揃えると、録音の「商品」列にもこの正式表記で記録されます。
        </p>
      </div>

      <form action={addProduct} className="bg-white rounded shadow p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">商品名 *</label>
          <input
            name="name"
            required
            placeholder="例: 新商品X"
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">かな（任意）</label>
          <input
            name="kana"
            placeholder="例: しんしょうひんえっくす"
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">並び順</label>
          <input
            name="sort_order"
            type="number"
            defaultValue={100}
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          + 追加
        </button>
      </form>

      <div className="bg-white rounded shadow divide-y">
        <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-gray-100 text-xs text-gray-600 font-medium">
          <div className="col-span-4">商品名</div>
          <div className="col-span-3">かな</div>
          <div className="col-span-1">並び順</div>
          <div className="col-span-1">状態</div>
          <div className="col-span-3 text-right">操作</div>
        </div>
        {products.map((p) => (
          <div
            key={p.id}
            className={`grid grid-cols-12 gap-3 px-4 py-2 items-center text-sm ${
              !p.is_active ? "bg-gray-50 text-gray-400" : ""
            }`}
          >
            <form action={updateProduct} className="contents">
              <input type="hidden" name="id" value={p.id} />
              <input
                name="name"
                defaultValue={p.name}
                required
                className="col-span-4 border rounded px-2 py-1"
              />
              <input
                name="kana"
                defaultValue={p.kana ?? ""}
                className="col-span-3 border rounded px-2 py-1"
              />
              <input
                name="sort_order"
                type="number"
                defaultValue={p.sort_order}
                className="col-span-1 border rounded px-2 py-1"
              />
              <div className="col-span-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    p.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {p.is_active ? "有効" : "無効"}
                </span>
              </div>
              <div className="col-span-3 flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </form>
            <form action={toggleActive} className="col-span-12 flex justify-end -mt-7 mr-24">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="next" value={p.is_active ? "false" : "true"} />
              <button
                type="submit"
                className={`px-3 py-1 rounded text-xs ${
                  p.is_active
                    ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {p.is_active ? "無効化" : "有効化"}
              </button>
            </form>
          </div>
        ))}
        {products.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            商品がまだ登録されていません
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500">
        ※ 無効化した商品はGeminiの辞書から外れます。過去の録音に記録された商品名はそのまま残ります。
      </p>
    </section>
  );
}
