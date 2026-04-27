import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { mixMonoWavs } from "@/lib/audio/mix";

const BUCKET = "voice-recordings";
const SIGNED_URL_TTL_SEC = 60 * 60;

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  await requireAdmin();

  const url = new URL(request.url);
  const trackParam = url.searchParams.get("track") ?? "mixed";
  const track = trackParam === "speaker" || trackParam === "mic" ? trackParam : "mixed";

  const supabase = createClient();
  const { data: recording, error } = await supabase
    .from("recordings")
    .select("mic_path,speaker_path")
    .eq("session_id", params.sessionId)
    .maybeSingle();

  if (error || !recording) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (track === "mixed") {
    if (!recording.mic_path || !recording.speaker_path) {
      return NextResponse.json({ error: "audio_unavailable" }, { status: 404 });
    }
    try {
      const [micBuf, spkBuf] = await Promise.all([
        downloadFromStorage(supabase, recording.mic_path),
        downloadFromStorage(supabase, recording.speaker_path),
      ]);
      const mixed = mixMonoWavs(micBuf, spkBuf);
      const filename = `${params.sessionId}.wav`;
      const ab = mixed.buffer.slice(mixed.byteOffset, mixed.byteOffset + mixed.byteLength) as ArrayBuffer;
      return new NextResponse(ab, {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": ab.byteLength.toString(),
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, max-age=0",
        },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "mix_failed";
      return NextResponse.json({ error: "mix_failed", detail: message }, { status: 500 });
    }
  }

  // Single-track fallback: redirect to a signed URL (cheaper than streaming through us).
  const path = track === "speaker" ? recording.speaker_path : recording.mic_path;
  if (!path) {
    return NextResponse.json({ error: "audio_unavailable" }, { status: 404 });
  }
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SEC, {
      download: `${params.sessionId}-${track}.wav`,
    });
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: "sign_failed", detail: signErr?.message },
      { status: 500 }
    );
  }
  return NextResponse.redirect(signed.signedUrl);
}

async function downloadFromStorage(
  supabase: ReturnType<typeof createClient>,
  path: string
): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    throw new Error(`storage_download_failed: ${path}`);
  }
  return await data.arrayBuffer();
}
