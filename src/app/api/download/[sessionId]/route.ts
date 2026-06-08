import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { buildStereoWav, concatChunks, extractChannelWav } from "@/lib/audio/chunks";

const BUCKET = "voice-recordings";

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
    .select("session_id")
    .eq("session_id", params.sessionId)
    .maybeSingle();

  if (error || !recording) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // chromeos版は {session_id}/meta.json + chunk_*.pcm (ステレオ生PCM) で保存される。
  // meta から chunk 数とレートを得て結合し、要求トラックの WAV を組み立てて返す。
  try {
    const metaRaw = await downloadFromStorage(supabase, `${params.sessionId}/meta.json`);
    const meta = JSON.parse(Buffer.from(metaRaw).toString("utf-8")) as {
      total_chunks?: number;
      sample_rate?: number;
    };
    const totalChunks = Number(meta.total_chunks);
    const sampleRate = Number(meta.sample_rate);
    if (!totalChunks || !sampleRate) {
      return NextResponse.json({ error: "audio_unavailable" }, { status: 404 });
    }

    const paths = Array.from(
      { length: totalChunks },
      (_, i) => `${params.sessionId}/chunk_${String(i).padStart(5, "0")}.pcm`
    );
    const buffers = await Promise.all(paths.map((p) => downloadFromStorage(supabase, p)));
    const pcm = concatChunks(buffers);

    let wav: Buffer;
    let suffix: string;
    if (track === "mic") {
      wav = extractChannelWav(pcm, 0, sampleRate); // L = オペレーター
      suffix = "mic";
    } else if (track === "speaker") {
      wav = extractChannelWav(pcm, 1, sampleRate); // R = お客様
      suffix = "speaker";
    } else {
      wav = buildStereoWav(pcm, sampleRate); // L/R 両方（話者が左右に分かれて聞きやすい）
      suffix = "mixed";
    }

    const ab = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer;
    return new NextResponse(ab, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": ab.byteLength.toString(),
        "Content-Disposition": `attachment; filename="${params.sessionId}-${suffix}.wav"`,
        "Cache-Control": "private, max-age=0",
      },
    });
  } catch {
    // chunk が無い（未保存 / 90日経過で削除済み）等
    return NextResponse.json({ error: "audio_unavailable" }, { status: 404 });
  }
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
