"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createUploadTarget, startUpload } from "./actions";

const BUCKET = "voice-recordings";
const ALLOWED = new Set(["wav", "mp3", "m4a"]);
const MAX_BYTES = 200 * 1024 * 1024; // 200MB

const INPUT_CLS =
  "border border-brand-border rounded-lg bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-brand-leaf focus:border-brand-leaf outline-none";

type Phase = "idle" | "uploading" | "starting" | "done" | "error";

export function UploadForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "uploading" || phase === "starting";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("audio") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    const callDate = ((form.elements.namedItem("call_date") as HTMLInputElement)?.value || "").trim();
    const note = ((form.elements.namedItem("note") as HTMLInputElement)?.value || "").trim();

    if (!file) {
      setPhase("error");
      setError("音声ファイルを選んでください");
      return;
    }
    if (file.size > MAX_BYTES) {
      setPhase("error");
      setError("ファイルが大きすぎます（200MBまで）");
      return;
    }
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED.has(ext)) {
      setPhase("error");
      setError("対応形式は wav / mp3 / m4a です");
      return;
    }

    // 1) 署名付きアップロードURLを取得
    setPhase("uploading");
    const target = await createUploadTarget(ext);
    if (!target.ok) {
      setPhase("error");
      setError(target.error);
      return;
    }

    // 2) ブラウザから直接 Storage へアップロード（Vercelのサイズ上限を回避）
    const supabase = createClient();
    const up = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(target.path, target.token, file);
    if (up.error) {
      setPhase("error");
      setError(`アップロードに失敗しました: ${up.error.message}`);
      return;
    }

    // 3) 書き起こしを起動（finalize がバックグラウンドで処理→自動保存）
    setPhase("starting");
    const res = await startUpload({
      uploadId: target.uploadId,
      ext,
      callDate: callDate || null,
      note: note || null,
    });
    if (!res.ok) {
      setPhase("error");
      setError(res.error ?? "書き起こしの起動に失敗しました");
      return;
    }

    setPhase("done");
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-white border border-brand-border rounded-card shadow-soft p-5 space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-brand-sub mb-1.5">音声ファイル</label>
        <input
          type="file"
          name="audio"
          accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
          required
          disabled={busy}
          className="block w-full text-sm text-brand-ink file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border file:border-brand-border file:bg-brand-soft file:text-brand-green file:font-bold file:text-xs hover:file:bg-brand-leaf/25 file:cursor-pointer disabled:opacity-50"
        />
        <p className="mt-1.5 text-xs text-brand-sub">wav / mp3 / m4a・最大1時間・200MBまで</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div className="sm:col-span-1">
          <label className="block text-xs font-bold text-brand-sub mb-1.5">通話日（任意）</label>
          <input type="date" name="call_date" disabled={busy} className={`${INPUT_CLS} w-full disabled:opacity-50`} />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs font-bold text-brand-sub mb-1.5">メモ（任意）</label>
          <input
            type="text"
            name="note"
            placeholder="例: 6月分の解約対応"
            disabled={busy}
            className={`${INPUT_CLS} w-full disabled:opacity-50`}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={busy}
          className="px-6 py-2.5 bg-brand-green text-white rounded-xl font-bold hover:bg-brand-dark hover:-translate-y-0.5 transition shadow-soft disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
        >
          {phase === "uploading"
            ? "アップロード中…"
            : phase === "starting"
              ? "起動中…"
              : "アップロードして書き起こす"}
        </button>
        {phase === "error" && error && (
          <p className="text-xs font-bold text-brand-sakura">{error}</p>
        )}
        {phase === "done" && (
          <p className="text-xs font-bold text-brand-green">
            ✓ アップロード完了。書き起こしを処理中です（下の一覧が「処理中」→「完了」に変わります）。
          </p>
        )}
      </div>
    </form>
  );
}
