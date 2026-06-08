"use client";

import { useFormState } from "react-dom";
import {
  StatefulSaveButton,
  type ActionResult,
} from "@/lib/forms/stateful-save-button";
import { updateMyDisplayName } from "../actions";

interface Props {
  initial: string;
  email: string;
}

const initialState: ActionResult = null;

export function DisplayNameForm({ initial, email }: Props) {
  const [state, action] = useFormState(updateMyDisplayName, initialState);
  return (
    <form
      action={action}
      className="bg-white border border-brand-border rounded-card p-5 shadow-soft"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
          🙂
        </span>
        <h2 className="font-bold text-brand-green">表示名</h2>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs text-brand-sub mb-1">
            表示名（録音一覧の「対応者」列に出る名前）
          </label>
          <input
            type="text"
            name="display_name"
            defaultValue={initial}
            maxLength={80}
            required
            className="w-full bg-white border border-brand-border rounded-lg px-3 py-1.5 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-leaf/40"
            placeholder="例：としひろ"
          />
          <p className="text-[10px] text-brand-sub mt-1">{email}</p>
        </div>
        <StatefulSaveButton result={state} label="保存" />
        {state && !state.ok && (
          <p className="w-full text-xs text-brand-sakura">{state.message}</p>
        )}
      </div>
    </form>
  );
}
