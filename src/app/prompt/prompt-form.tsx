"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

export type SavePromptState =
  | { ok: true; message: string; ts: number }
  | { ok: false; message: string; ts: number }
  | null;

function SubmitButton({
  lastSavedAt,
  lastErrorAt,
}: {
  lastSavedAt: number | null;
  lastErrorAt: number | null;
}) {
  const { pending } = useFormStatus();
  const [showSaved, setShowSaved] = useState(false);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (!lastSavedAt) return;
    setShowSaved(true);
    setShowError(false);
    const timer = setTimeout(() => setShowSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [lastSavedAt]);

  useEffect(() => {
    if (!lastErrorAt) return;
    setShowError(true);
    setShowSaved(false);
    const timer = setTimeout(() => setShowError(false), 5000);
    return () => clearTimeout(timer);
  }, [lastErrorAt]);

  if (pending) {
    return (
      <button
        type="submit"
        disabled
        className="px-4 py-2 bg-blue-400 text-white rounded inline-flex items-center gap-2"
      >
        <span
          className="inline-block h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin"
          aria-hidden
        />
        保存中…
      </button>
    );
  }

  if (showSaved) {
    return (
      <button
        type="submit"
        className="px-4 py-2 bg-green-600 text-white rounded transition-colors duration-300"
      >
        ✓ 保存しました
      </button>
    );
  }

  if (showError) {
    return (
      <button
        type="submit"
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        ✕ 保存失敗（再試行）
      </button>
    );
  }

  return (
    <button
      type="submit"
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      保存
    </button>
  );
}

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
        <SubmitButton
          lastSavedAt={state?.ok === true ? state.ts : null}
          lastErrorAt={state?.ok === false ? state.ts : null}
        />
      </div>
    </form>
  );
}
