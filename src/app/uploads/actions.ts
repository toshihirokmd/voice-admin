"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { requestUploadTranscription } from "@/lib/finalize";

const BUCKET = "voice-recordings";
const ALLOWED = new Map<string, string>([
  ["wav", "audio/wav"],
  ["mp3", "audio/mpeg"],
  ["m4a", "audio/mp4"],
]);
const MAX_BYTES = 200 * 1024 * 1024; // 200MB

export type ActionResult = { ok: boolean; error?: string };

type Svc = ReturnType<typeof createServiceClient>;

/** ISO 文字列 → "YYYY年M月D日"（finalize の年補完用）。空/不正は null。 */
function jpDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 署名URL発行 → finalize書き起こし → transcripts保存 → status=transcribed。失敗時は例外。 */
async function transcribeAndSave(
  svc: Svc,
  recordingId: string,
  path: string,
  mime: string,
  callDate: string | null,
): Promise<void> {
  const signed = await svc.storage.from(BUCKET).createSignedUrl(path, 600);
  if (signed.error || !signed.data) {
    throw new Error(signed.error?.message ?? "署名URLの発行に失敗しました");
  }
  const r = await requestUploadTranscription({
    audioUrl: signed.data.signedUrl,
    mimeType: mime,
    callDate,
  });
  await svc.from("transcripts").delete().eq("recording_id", recordingId);
  const ins = await svc.from("transcripts").insert({
    recording_id: recordingId,
    merged_text: r.merged_text,
    summary: r.summary,
    title: r.title,
    tags: r.tags ?? [],
    products: r.products ?? [],
    tokens_in: 0,
    tokens_out: 0,
    raw_json: {},
  });
  if (ins.error) throw new Error(ins.error.message);
  await svc.from("recordings").update({ status: "transcribed" }).eq("id", recordingId);
}

/** アップロード → 書き起こし。useActionState 用に (prev, formData) 形式。 */
export async function startUpload(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAdmin();
  const file = formData.get("audio") as File | null;
  const callDateRaw = ((formData.get("call_date") as string) || "").trim();
  const note = ((formData.get("note") as string) || "").trim();

  if (!file || file.size === 0) return { ok: false, error: "音声ファイルを選んでください" };
  if (file.size > MAX_BYTES) return { ok: false, error: "ファイルが大きすぎます（200MBまで）" };
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mime = ALLOWED.get(ext);
  if (!mime) return { ok: false, error: "対応形式は wav / mp3 / m4a です" };

  const svc = createServiceClient();
  const uploadId = crypto.randomUUID();
  const path = `uploads/${uploadId}/original.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const up = await svc.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: mime, upsert: false });
  if (up.error) return { ok: false, error: `保存に失敗しました: ${up.error.message}` };

  const startedAtDate = callDateRaw ? new Date(callDateRaw) : new Date();
  const startedAt = (Number.isNaN(startedAtDate.getTime()) ? new Date() : startedAtDate).toISOString();
  const ins = await svc
    .from("recordings")
    .insert({
      session_id: uploadId,
      source: "upload",
      status: "processing",
      started_at: startedAt,
      operator_email: user.email,
      note: note || null,
      mic_path: path,
    })
    .select("id")
    .single();
  if (ins.error || !ins.data) {
    return { ok: false, error: `記録の作成に失敗しました: ${ins.error?.message ?? ""}` };
  }
  const recordingId = ins.data.id as string;

  try {
    await transcribeAndSave(svc, recordingId, path, mime, jpDate(callDateRaw || null));
  } catch {
    await svc.from("recordings").update({ status: "failed" }).eq("id", recordingId);
    revalidatePath("/uploads");
    return { ok: false, error: "書き起こしに失敗しました（詳細ページから再実行できます）" };
  }
  revalidatePath("/uploads");
  return { ok: true };
}

/** 失敗したアップロードを再実行。useActionState 用に (prev, formData) 形式。 */
export async function retryUpload(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const recordingId = (formData.get("recording_id") as string) || "";
  if (!recordingId) return { ok: false, error: "対象がありません" };

  const svc = createServiceClient();
  const rec = await svc
    .from("recordings")
    .select("id,started_at,mic_path,source")
    .eq("id", recordingId)
    .single();
  if (rec.error || !rec.data || rec.data.source !== "upload") {
    return { ok: false, error: "アップロード録音が見つかりません" };
  }
  const path = (rec.data.mic_path as string) || "";
  if (!path) return { ok: false, error: "音声ファイルのパスがありません" };
  const ext = (path.split(".").pop() ?? "mp3").toLowerCase();
  const mime = ALLOWED.get(ext) ?? "audio/mpeg";

  await svc.from("recordings").update({ status: "processing" }).eq("id", recordingId);
  try {
    await transcribeAndSave(svc, recordingId, path, mime, jpDate(rec.data.started_at as string));
  } catch {
    await svc.from("recordings").update({ status: "failed" }).eq("id", recordingId);
    revalidatePath(`/uploads/${recordingId}`);
    return { ok: false, error: "再実行に失敗しました" };
  }
  revalidatePath(`/uploads/${recordingId}`);
  revalidatePath("/uploads");
  return { ok: true };
}
