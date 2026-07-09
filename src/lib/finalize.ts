import "server-only";

/**
 * finalize の /transcribe-upload を呼ぶ薄いクライアント。
 * 音声そのものは送らず、Storage の署名付きURLを渡す（finalize がそこからDLする）。
 */

export interface UploadTranscriptResult {
  merged_text: string;
  summary: string;
  title: string;
  tags: string[];
  products: string[];
}

export async function requestUploadTranscription(params: {
  audioUrl: string;
  mimeType: string;
  callDate: string | null; // "YYYY年M月D日" or null（年補完用）
}): Promise<UploadTranscriptResult> {
  const base = process.env.FINALIZE_URL;
  const secret = process.env.UPLOAD_SHARED_SECRET;
  if (!base || !secret) {
    throw new Error("FINALIZE_URL / UPLOAD_SHARED_SECRET が未設定です");
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/transcribe-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Upload-Secret": secret,
    },
    body: JSON.stringify({
      audio_url: params.audioUrl,
      mime_type: params.mimeType,
      call_date: params.callDate,
    }),
  });
  if (!res.ok) {
    throw new Error(`finalize /transcribe-upload ${res.status}`);
  }
  return (await res.json()) as UploadTranscriptResult;
}
