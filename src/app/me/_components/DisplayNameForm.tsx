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
      className="flex flex-wrap items-center gap-3 bg-white border rounded-lg p-4"
    >
      <div className="flex-1 min-w-[240px]">
        <label className="block text-xs text-gray-500 mb-1">
          表示名（録音一覧の「対応者」列に出る名前）
        </label>
        <input
          type="text"
          name="display_name"
          defaultValue={initial}
          maxLength={80}
          required
          className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="例：としひろ"
        />
        <p className="text-[10px] text-gray-400 mt-1">{email}</p>
      </div>
      <StatefulSaveButton result={state} label="保存" />
      {state && !state.ok && (
        <p className="w-full text-xs text-red-600">{state.message}</p>
      )}
    </form>
  );
}
