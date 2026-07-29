import "server-only";

/**
 * finalize の /transcribe-upload-async を呼ぶ薄いクライアント。
 * 音声は送らず、session_id だけ渡して「発火」する。finalize が Storage から
 * 音声を取り、バックグラウンドで書き起こして自分で DB 保存する（即 202 が返る）。
 */

export async function requestUploadTranscriptionAsync(params: {
  sessionId: string;
}): Promise<void> {
  const base = process.env.FINALIZE_URL;
  const secret = process.env.UPLOAD_SHARED_SECRET;
  if (!base || !secret) {
    throw new Error("FINALIZE_URL / UPLOAD_SHARED_SECRET が未設定です");
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/transcribe-upload-async`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Upload-Secret": secret,
    },
    body: JSON.stringify({ session_id: params.sessionId }),
  });
  // 202 = 受付OK（バックグラウンド処理開始）。それ以外は起動失敗として扱う。
  if (res.status !== 202 && !res.ok) {
    throw new Error(`finalize /transcribe-upload-async ${res.status}`);
  }
}
