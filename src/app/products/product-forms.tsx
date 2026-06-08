"use client";

import { useFormState } from "react-dom";
import {
  ActionResult,
  StatefulSaveButton,
} from "@/lib/forms/stateful-save-button";

type Product = {
  id: string;
  name: string;
  kana: string | null;
  sort_order: number;
  is_active: boolean;
};

type ProductActionState = ActionResult;
type ProductAction = (
  prev: ProductActionState,
  formData: FormData,
) => Promise<ProductActionState>;

export function AddProductForm({ action }: { action: ProductAction }) {
  const [state, formAction] = useFormState<ProductActionState, FormData>(
    action,
    null,
  );
  return (
    <form
      action={formAction}
      className="bg-white border border-brand-border rounded-card shadow-soft p-5 grid grid-cols-1 sm:grid-cols-4 gap-5 items-end"
    >
      <div className="sm:col-span-4 flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
          ➕
        </span>
        <h2 className="font-bold text-brand-green">商品を追加</h2>
      </div>
      <div>
        <label className="block text-xs text-brand-sub mb-1">商品名 *</label>
        <input
          name="name"
          required
          placeholder="例: 新商品X"
          className="w-full border border-brand-border rounded-lg bg-white px-2 py-1.5 text-sm focus:ring-2 focus:ring-brand-leaf focus:border-brand-leaf outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-sub mb-1">かな（任意）</label>
        <input
          name="kana"
          placeholder="例: しんしょうひんえっくす"
          className="w-full border border-brand-border rounded-lg bg-white px-2 py-1.5 text-sm focus:ring-2 focus:ring-brand-leaf focus:border-brand-leaf outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-sub mb-1">並び順</label>
        <input
          name="sort_order"
          type="number"
          defaultValue={100}
          className="w-full border border-brand-border rounded-lg bg-white px-2 py-1.5 text-sm focus:ring-2 focus:ring-brand-leaf focus:border-brand-leaf outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <StatefulSaveButton
          result={state}
          label="+ 追加"
          savingLabel="追加中…"
          savedLabel="✓ 追加しました"
          errorLabel="✕ 追加失敗"
        />
        {state?.ok === false && (
          <p className="text-xs text-brand-sakura">{state.message}</p>
        )}
      </div>
    </form>
  );
}

export function ProductRow({
  product,
  updateAction,
  toggleAction,
}: {
  product: Product;
  updateAction: ProductAction;
  toggleAction: ProductAction;
}) {
  const [updateState, updateFormAction] = useFormState<
    ProductActionState,
    FormData
  >(updateAction, null);
  const [toggleState, toggleFormAction] = useFormState<
    ProductActionState,
    FormData
  >(toggleAction, null);

  return (
    <div
      className={`grid grid-cols-12 gap-3 px-4 py-3 items-center text-sm text-brand-ink ${
        !product.is_active ? "bg-brand-soft text-brand-sub" : ""
      }`}
    >
      <form action={updateFormAction} className="contents">
        <input type="hidden" name="id" value={product.id} />
        <input
          name="name"
          defaultValue={product.name}
          required
          className="col-span-4 border border-brand-border rounded-lg bg-white px-2 py-1.5 focus:ring-2 focus:ring-brand-leaf focus:border-brand-leaf outline-none"
        />
        <input
          name="kana"
          defaultValue={product.kana ?? ""}
          className="col-span-3 border border-brand-border rounded-lg bg-white px-2 py-1.5 focus:ring-2 focus:ring-brand-leaf focus:border-brand-leaf outline-none"
        />
        <input
          name="sort_order"
          type="number"
          defaultValue={product.sort_order}
          className="col-span-1 border border-brand-border rounded-lg bg-white px-2 py-1.5 focus:ring-2 focus:ring-brand-leaf focus:border-brand-leaf outline-none"
        />
        <div className="col-span-1">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              product.is_active
                ? "bg-brand-soft text-brand-green"
                : "bg-brand-ssoft text-brand-sakura"
            }`}
          >
            {product.is_active ? "有効" : "無効"}
          </span>
        </div>
        <div className="col-span-3 flex justify-end gap-2">
          <StatefulSaveButton result={updateState} size="sm" />
        </div>
      </form>
      <form
        action={toggleFormAction}
        className="col-span-12 flex justify-end -mt-7 mr-24"
      >
        <input type="hidden" name="id" value={product.id} />
        <input
          type="hidden"
          name="next"
          value={product.is_active ? "false" : "true"}
        />
        <StatefulSaveButton
          result={toggleState}
          label={product.is_active ? "無効化" : "有効化"}
          savingLabel="切替中…"
          savedLabel={product.is_active ? "✓ 無効化しました" : "✓ 有効化しました"}
          errorLabel="✕ 失敗"
          variant={product.is_active ? "secondary" : "success"}
          size="sm"
        />
      </form>
    </div>
  );
}
