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
      className="px-5 py-2 text-xs bg-brand-green text-white rounded-xl font-bold hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "再実行中…" : "再実行する"}
    </button>
  );
}

export function RetryButton({ recordingId }: { recordingId: string }) {
  const [state, action] = useFormState(retryUpload, INITIAL);
  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="recording_id" value={recordingId} />
      <Btn />
      {state.error && <p className="text-xs font-bold text-brand-sakura">{state.error}</p>}
    </form>
  );
}
