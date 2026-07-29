"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { requestUploadTranscriptionAsync } from "@/lib/finalize";

const BUCKET = "voice-recordings";
const ALLOWED = new Map<string, string>([
  ["wav", "audio/wav"],
  ["mp3", "audio/mpeg"],
  ["m4a", "audio/mp4"],
]);

export type ActionResult = { ok: boolean; error?: string };

/** 署名付きアップロードURL発行の結果（ブラウザが直接Storageへ送るのに使う）。 */
export type UploadTarget =
  | { ok: true; uploadId: string; path: string; token: string }
  | { ok: false; error: string };

/**
 * ブラウザ直アップロード用の署名付きURLを発行する。
 * 大きいファイルを Server Action 経由で送ると Vercel の本文サイズ上限(~4.5MB)に
 * 当たるため、ブラウザが署名URLへ直接アップロードする。ここではパス確保とトークン発行だけ。
 */
export async function createUploadTarget(ext: string): Promise<UploadTarget> {
  await requireUser();
  const e = (ext || "").toLowerCase();
  if (!ALLOWED.has(e)) {
    return { ok: false, error: "対応形式は wav / mp3 / m4a です" };
  }
  const svc = createServiceClient();
  const uploadId = crypto.randomUUID();
  const path = `uploads/${uploadId}/original.${e}`;
  const signed = await svc.storage.from(BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) {
    return { ok: false, error: `アップロード準備に失敗しました: ${signed.error?.message ?? ""}` };
  }
  return { ok: true, uploadId, path, token: signed.data.token };
}

/**
 * 直アップロード完了後に呼ぶ。recordings(processing) を作成し、finalize を「発火」して即返す。
 * 書き起こしは finalize がバックグラウンドで自走保存する（このAction内では待たない）。
 */
export async function startUpload(input: {
  uploadId: string;
  ext: string;
  callDate: string | null;
  note: string | null;
}): Promise<ActionResult> {
  const user = await requireUser();
  const ext = (input.ext || "").toLowerCase();
  if (!input.uploadId || !ALLOWED.has(ext)) {
    return { ok: false, error: "不正なアップロードです" };
  }
  const path = `uploads/${input.uploadId}/original.${ext}`;
  const svc = createServiceClient();

  // アップロード済みか確認（ブラウザ直送の取りこぼし防止）。存在しなければ error。
  const head = await svc.storage.from(BUCKET).createSignedUrl(path, 60);
  if (head.error) {
    return { ok: false, error: "音声がアップロードされていません" };
  }

  const callDateRaw = (input.callDate || "").trim();
  // input[type=date] は "2026-07-22"。new Date("2026-07-22") は UTC 0時扱いで
  // JST 表示だと必ず 9:00 になる（通話日が全部9時問題）。JST 0時として解釈する。
  const startedAtDate = callDateRaw
    ? new Date(`${callDateRaw}T00:00:00+09:00`)
    : new Date();
  const startedAt = (
    Number.isNaN(startedAtDate.getTime()) ? new Date() : startedAtDate
  ).toISOString();

  const ins = await svc
    .from("recordings")
    .insert({
      session_id: input.uploadId,
      source: "upload",
      status: "processing",
      started_at: startedAt,
      operator_email: user.email,
      note: (input.note || "").trim() || null,
      mic_path: path,
    })
    .select("id")
    .single();
  if (ins.error || !ins.data) {
    return { ok: false, error: `記録の作成に失敗しました: ${ins.error?.message ?? ""}` };
  }

  try {
    await requestUploadTranscriptionAsync({ sessionId: input.uploadId });
  } catch {
    await svc.from("recordings").update({ status: "failed" }).eq("id", ins.data.id);
    revalidatePath("/uploads");
    return { ok: false, error: "書き起こしの起動に失敗しました（詳細ページから再実行できます）" };
  }
  revalidatePath("/uploads");
  return { ok: true };
}

/** 失敗したアップロードを再実行。finalize を再発火するだけ（音声はStorageに残っている）。 */
export async function retryUpload(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const recordingId = (formData.get("recording_id") as string) || "";
  if (!recordingId) return { ok: false, error: "対象がありません" };

  const svc = createServiceClient();
  const rec = await svc
    .from("recordings")
    .select("id,session_id,mic_path,source")
    .eq("id", recordingId)
    .single();
  if (rec.error || !rec.data || rec.data.source !== "upload") {
    return { ok: false, error: "アップロード録音が見つかりません" };
  }
  const path = (rec.data.mic_path as string) || "";
  if (!path) return { ok: false, error: "音声ファイルのパスがありません" };

  await svc.from("recordings").update({ status: "processing" }).eq("id", recordingId);
  try {
    await requestUploadTranscriptionAsync({ sessionId: rec.data.session_id as string });
  } catch {
    await svc.from("recordings").update({ status: "failed" }).eq("id", recordingId);
    revalidatePath(`/uploads/${recordingId}`);
    return { ok: false, error: "再実行の起動に失敗しました" };
  }
  revalidatePath(`/uploads/${recordingId}`);
  revalidatePath("/uploads");
  return { ok: true };
}
