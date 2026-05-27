import { GoogleGenAI, Type } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { jstYmdToIso } from "@/lib/dashboard/date";

const MODEL = "gemini-2.5-flash";

export interface HighlightEntry {
  session_id: string;
  title: string;
  quote: string;
  comment: string;
}

export interface ReportHighlights {
  good_handling: HighlightEntry[];
  good_phrase: HighlightEntry[];
  positive_voc: HighlightEntry[];
  improvement_voc: HighlightEntry[];
}

export interface GeneratedReport {
  highlights: ReportHighlights;
  overall_comment: string;
  tokens_in: number;
  tokens_out: number;
  model: string;
  source_transcript_count: number;
}

interface TranscriptForReport {
  session_id: string;
  title: string | null;
  summary: string | null;
  merged_text: string | null;
  products: string[] | null;
  duration_sec: number | null;
}

/**
 * 指定オペレーターの指定日付の transcripts を集めて Gemini に投げ、
 * 4 カテゴリのハイライトを抽出した「今日のレポート」を生成する。
 *
 * - 通話が 1 件もなければ null を返す（呼出側で「本日の通話なし」表示）
 * - Gemini が JSON 形式で返すよう responseSchema で制約
 */
export async function generateDailyReport(
  supabase: SupabaseClient,
  operatorEmail: string,
  reportDateYmd: string
): Promise<GeneratedReport | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY が設定されていません");
  }

  const transcripts = await fetchTranscriptsForDay(
    supabase,
    operatorEmail,
    reportDateYmd
  );
  if (transcripts.length === 0) return null;

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(transcripts);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: REPORT_SCHEMA,
      temperature: 0.4,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini からの応答が空でした");
  }
  const parsed = JSON.parse(text) as {
    highlights: ReportHighlights;
    overall_comment: string;
  };

  // Gemini が返した session_id が実在の通話に含まれるか検証 (hallucination 対策)
  const validIds = new Set(transcripts.map((t) => t.session_id));
  const cleaned: ReportHighlights = {
    good_handling: filterValid(parsed.highlights.good_handling, validIds),
    good_phrase: filterValid(parsed.highlights.good_phrase, validIds),
    positive_voc: filterValid(parsed.highlights.positive_voc, validIds),
    improvement_voc: filterValid(parsed.highlights.improvement_voc, validIds),
  };

  return {
    highlights: cleaned,
    overall_comment: parsed.overall_comment ?? "",
    tokens_in: response.usageMetadata?.promptTokenCount ?? 0,
    tokens_out: response.usageMetadata?.candidatesTokenCount ?? 0,
    model: MODEL,
    source_transcript_count: transcripts.length,
  };
}

function filterValid(
  list: HighlightEntry[] | undefined,
  validIds: Set<string>
): HighlightEntry[] {
  if (!Array.isArray(list)) return [];
  return list.filter((h) => validIds.has(h.session_id)).slice(0, 3);
}

async function fetchTranscriptsForDay(
  supabase: SupabaseClient,
  operatorEmail: string,
  ymd: string
): Promise<TranscriptForReport[]> {
  const startIso = jstYmdToIso(ymd, false);
  const endExclusiveIso = jstYmdToIso(addDay(ymd, 1), false);

  // 当日 + 自分の recordings を取得
  const { data: recRows, error: recErr } = await supabase
    .from("recordings")
    .select("id, session_id, duration_sec")
    .eq("operator_email", operatorEmail)
    .gte("started_at", startIso)
    .lt("started_at", endExclusiveIso);
  if (recErr) throw new Error(`recordings query: ${recErr.message}`);
  const recordings = (recRows ?? []) as {
    id: string;
    session_id: string;
    duration_sec: number | null;
  }[];
  if (recordings.length === 0) return [];

  const recordingIds = recordings.map((r) => r.id);
  const { data: trRows, error: trErr } = await supabase
    .from("transcripts")
    .select("recording_id, title, summary, merged_text, products")
    .in("recording_id", recordingIds);
  if (trErr) throw new Error(`transcripts query: ${trErr.message}`);

  const trByRec = new Map<string, (typeof trRows)[number]>();
  for (const t of trRows ?? []) {
    if (t.recording_id) trByRec.set(t.recording_id as string, t);
  }

  const result: TranscriptForReport[] = [];
  for (const r of recordings) {
    const t = trByRec.get(r.id);
    if (!t) continue;
    result.push({
      session_id: r.session_id,
      title: (t.title as string) ?? null,
      summary: (t.summary as string) ?? null,
      merged_text: (t.merged_text as string) ?? null,
      products: (t.products as string[]) ?? null,
      duration_sec: r.duration_sec,
    });
  }
  return result;
}

function buildPrompt(transcripts: TranscriptForReport[]): string {
  const blocks = transcripts.map((t, i) => {
    const products = (t.products ?? []).join(", ") || "(なし)";
    // merged_text は長すぎる可能性があるので 2000 字でクリップ
    const merged = (t.merged_text ?? "").slice(0, 2000);
    return [
      `## 通話 ${i + 1}`,
      `session_id: ${t.session_id}`,
      `タイトル: ${t.title ?? "(なし)"}`,
      `通話時間: ${t.duration_sec ?? "?"}秒`,
      `商品: ${products}`,
      `要約: ${t.summary ?? "(なし)"}`,
      `本文:\n${merged}`,
    ].join("\n");
  });

  return [
    "あなたはコールセンター品質管理の専門家です。以下は1人のオペレーターの本日の通話記録です。",
    "",
    "次の4カテゴリで、特に印象に残る通話を最大3件ずつ抽出してください:",
    "",
    "1. **good_handling** (質の高い対応): オペレーターが特に丁寧・迅速・的確に対応した通話",
    "2. **good_phrase** (印象的なフレーズ): 顧客の心に響く言葉や、参考になる切り返しを使った通話",
    "3. **positive_voc** (顧客の喜びの声): 顧客から商品やサービスへの感謝・喜びの声があった通話",
    "4. **improvement_voc** (商品改善のヒント): 顧客から商品への具体的な改善要望・問題指摘があった通話",
    "",
    "各カテゴリの抽出方針:",
    "- 該当する通話が無ければ空配列を返してください（無理に選ばない）",
    "- session_id は必ず上記通話一覧の中から正確にコピーしてください（捏造禁止）",
    "- quote は本文から該当箇所を抜粋した30〜80字程度の引用",
    "- comment は「なぜそのカテゴリに選んだか」の1文（30〜60字）",
    "- overall_comment は本日の通話全体を踏まえた一言（オペレーターへのフィードバック、80〜150字）",
    "",
    "--- 本日の通話記録 ---",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}

function addDay(ymd: string, delta: number): string {
  const dt = new Date(`${ymd}T00:00:00+09:00`);
  dt.setUTCDate(dt.getUTCDate() + delta);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

const HIGHLIGHT_ENTRY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    session_id: { type: Type.STRING },
    title: { type: Type.STRING },
    quote: { type: Type.STRING },
    comment: { type: Type.STRING },
  },
  required: ["session_id", "title", "quote", "comment"],
};

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    highlights: {
      type: Type.OBJECT,
      properties: {
        good_handling: { type: Type.ARRAY, items: HIGHLIGHT_ENTRY_SCHEMA },
        good_phrase: { type: Type.ARRAY, items: HIGHLIGHT_ENTRY_SCHEMA },
        positive_voc: { type: Type.ARRAY, items: HIGHLIGHT_ENTRY_SCHEMA },
        improvement_voc: { type: Type.ARRAY, items: HIGHLIGHT_ENTRY_SCHEMA },
      },
      required: [
        "good_handling",
        "good_phrase",
        "positive_voc",
        "improvement_voc",
      ],
    },
    overall_comment: { type: Type.STRING },
  },
  required: ["highlights", "overall_comment"],
};
