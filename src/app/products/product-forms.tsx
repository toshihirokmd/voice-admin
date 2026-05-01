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
      className="bg-white rounded shadow p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
    >
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
      <div className="flex flex-col gap-1">
        <StatefulSaveButton
          result={state}
          label="+ 追加"
          savingLabel="追加中…"
          savedLabel="✓ 追加しました"
          errorLabel="✕ 追加失敗"
        />
        {state?.ok === false && (
          <p className="text-xs text-red-600">{state.message}</p>
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
      className={`grid grid-cols-12 gap-3 px-4 py-2 items-center text-sm ${
        !product.is_active ? "bg-gray-50 text-gray-400" : ""
      }`}
    >
      <form action={updateFormAction} className="contents">
        <input type="hidden" name="id" value={product.id} />
        <input
          name="name"
          defaultValue={product.name}
          required
          className="col-span-4 border rounded px-2 py-1"
        />
        <input
          name="kana"
          defaultValue={product.kana ?? ""}
          className="col-span-3 border rounded px-2 py-1"
        />
        <input
          name="sort_order"
          type="number"
          defaultValue={product.sort_order}
          className="col-span-1 border rounded px-2 py-1"
        />
        <div className="col-span-1">
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              product.is_active
                ? "bg-green-100 text-green-800"
                : "bg-gray-200 text-gray-600"
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
