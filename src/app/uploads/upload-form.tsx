"use client";

import { useFormState, useFormStatus } from "react-dom";
import { startUpload, type ActionResult } from "./actions";

const INITIAL: ActionResult = { ok: false };

const INPUT_CLS =
  "border border-brand-border rounded-lg bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-brand-leaf focus:border-brand-leaf outline-none";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-6 py-2.5 bg-brand-green text-white rounded-xl font-bold hover:bg-brand-dark hover:-translate-y-0.5 transition shadow-soft disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
    >
      {pending ? "書き起こし中…" : "アップロードして書き起こす"}
    </button>
  );
}

export function UploadForm() {
  const [state, action] = useFormState(startUpload, INITIAL);
  return (
    <form
      action={action}
      className="bg-white border border-brand-border rounded-card shadow-soft p-5 space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-brand-sub mb-1.5">音声ファイル</label>
        <input
          type="file"
          name="audio"
          accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
          required
          className="block w-full text-sm text-brand-ink file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border file:border-brand-border file:bg-brand-soft file:text-brand-green file:font-bold file:text-xs hover:file:bg-brand-leaf/25 file:cursor-pointer"
        />
        <p className="mt-1.5 text-xs text-brand-sub">wav / mp3 / m4a・200MBまで</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-brand-sub mb-1.5">通話日（任意）</label>
          <input type="date" name="call_date" className={`${INPUT_CLS} w-full`} />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs font-bold text-brand-sub mb-1.5">メモ（任意）</label>
          <input
            type="text"
            name="note"
            placeholder="例: 6月分の解約対応"
            className={`${INPUT_CLS} w-full`}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SubmitButton />
        {state.error && (
          <p className="text-xs font-bold text-brand-sakura">{state.error}</p>
        )}
        {state.ok && (
          <p className="text-xs font-bold text-brand-green">
            ✓ 書き起こしが完了しました。下の一覧に追加されています。
          </p>
        )}
      </div>
    </form>
  );
}
