"use client";

import { useFormState } from "react-dom";
import {
  ActionResult,
  StatefulSaveButton,
} from "@/lib/forms/stateful-save-button";

export type SavePromptState = ActionResult;

export function PromptForm({
  defaultBody,
  meta,
  action,
}: {
  defaultBody: string;
  meta: string;
  action: (
    prev: SavePromptState,
    formData: FormData,
  ) => Promise<SavePromptState>;
}) {
  const [state, formAction] = useFormState<SavePromptState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="bg-white rounded shadow p-4 space-y-3">
      <textarea
        name="body"
        defaultValue={defaultBody}
        rows={30}
        className="w-full font-mono text-sm border rounded p-3"
        required
      />
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-gray-500 flex-1">
          <p>{meta}</p>
          {state?.ok === false && (
            <p className="mt-1 text-red-600">エラー: {state.message}</p>
          )}
          {state?.ok === true && (
            <p className="mt-1 text-green-700">
              {new Date(state.ts).toLocaleString("ja-JP", {
                hour12: false,
                timeZone: "Asia/Tokyo",
              })}{" "}
              に保存しました
            </p>
          )}
        </div>
        <StatefulSaveButton result={state} />
      </div>
    </form>
  );
}
