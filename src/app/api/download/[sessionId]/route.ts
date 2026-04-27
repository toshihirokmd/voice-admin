import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "voice-recordings";
const SIGNED_URL_TTL_SEC = 60 * 60; // 1 hour

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  await requireAdmin();

  const url = new URL(request.url);
  const track = url.searchParams.get("track") === "speaker" ? "speaker" : "mic";

  const supabase = createClient();
  const { data: recording, error } = await supabase
    .from("recordings")
    .select("mic_path,speaker_path")
    .eq("session_id", params.sessionId)
    .maybeSingle();

  if (error || !recording) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
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
