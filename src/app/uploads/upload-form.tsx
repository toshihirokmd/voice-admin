"use client";

import { useFormState, useFormStatus } from "react-dom";
import { startUpload, type ActionResult } from "./actions";

const INITIAL: ActionResult = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
    >
      {pending ? "書き起こし中…（長い音声は時間がかかります）" : "アップロードして書き起こす"}
    </button>
  );
}

export function UploadForm() {
  const [state, action] = useFormState(startUpload, INITIAL);
  return (
    <form action={action} className="space-y-3 rounded border p-4">
      <div>
        <label className="block text-sm font-medium">音声ファイル（wav / mp3 / m4a・200MBまで）</label>
        <input
          type="file"
          name="audio"
          accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
          required
          className="mt-1 block w-full text-sm"
        />
      </div>
      <div className="flex gap-4">
        <div>
          <label className="block text-sm font-medium">通話日（任意）</label>
          <input type="date" name="call_date" className="mt-1 rounded border px-2 py-1 text-sm" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium">メモ（任意）</label>
          <input type="text" name="note" placeholder="例: 6月分の解約対応" className="mt-1 w-full rounded border px-2 py-1 text-sm" />
        </div>
      </div>
      <SubmitButton />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-700">書き起こしが完了しました。下の一覧に追加されています。</p>}
    </form>
  );
}
