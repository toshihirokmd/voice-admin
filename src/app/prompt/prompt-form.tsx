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
    <form action={formAction} className="bg-white border border-brand-border rounded-card shadow-soft p-5 space-y-3">
      <textarea
        name="body"
        defaultValue={defaultBody}
        rows={30}
        className="w-full font-mono text-sm border border-brand-border rounded-lg bg-white p-3 text-brand-ink focus:ring-2 focus:ring-brand-leaf focus:border-brand-leaf outline-none"
        required
      />
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-brand-sub flex-1">
          <p>{meta}</p>
          {state?.ok === false && (
            <p className="mt-1 text-brand-sakura">エラー: {state.message}</p>
          )}
          {state?.ok === true && (
            <p className="mt-1 text-brand-green">
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
