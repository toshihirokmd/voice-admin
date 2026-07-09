"use client";

import { useFormState, useFormStatus } from "react-dom";
import { retryUpload, type ActionResult } from "./actions";

const INITIAL: ActionResult = { ok: false };

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
    >
      {pending ? "再実行中…" : "再実行する"}
    </button>
  );
}

export function RetryButton({ recordingId }: { recordingId: string }) {
  const [state, action] = useFormState(retryUpload, INITIAL);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="recording_id" value={recordingId} />
      <Btn />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
