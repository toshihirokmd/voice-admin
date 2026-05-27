/**
 * API 費用の概算。Vertex AI Gemini 2.5 Flash の従量課金、Cloud Run の
 * 最小インスタンス費、Supabase Pro 固定費の合計を出す。
 *
 * 実 token (transcripts.tokens_in/tokens_out) があれば実費計算、
 * なければ avgDurationSec から推定する。
 */

// Gemini 2.5 Flash の単価 (2026-05 時点)
const GEMINI_AUDIO_TOKENS_PER_SEC = 32;
const GEMINI_INPUT_USD_PER_1M = 0.3; // 音声入力 (実際の tokens_in は audio token を含む合算値)
const GEMINI_OUTPUT_USD_PER_1M = 0.3;
const FALLBACK_PROMPT_TOKENS_PER_CALL = 1500;
const FALLBACK_OUTPUT_TOKENS_PER_SEC = 5;
const FALLBACK_AVG_DURATION_SEC = 180;

const CLOUD_RUN_FIXED_USD_PER_MONTH = 8;
const CLOUD_RUN_VARIABLE_USD_PER_CALL = 0.002;

const SUPABASE_FIXED_USD_PER_MONTH = 25;

const USD_TO_JPY = 155;

export interface ApiCostEstimate {
  /** "actual" = transcripts の tokens_in/out 集計、"estimate" = 推定 */
  source: "actual" | "estimate";
  transcriptCount: number;
  tokensIn: number;
  tokensOut: number;
  geminiUsd: number;
  geminiInputUsd: number;
  geminiOutputUsd: number;
  cloudRunUsd: number;
  supabaseUsd: number;
  totalUsd: number;
  totalJpy: number;
}

export function estimateApiCost(
  transcriptCount: number,
  avgDurationSec: number | null,
  totalTokensIn: number,
  totalTokensOut: number
): ApiCostEstimate {
  // 実 token があれば優先 (transcripts.tokens_in/out > 0)
  const hasActual = totalTokensIn > 0 || totalTokensOut > 0;

  let tokensIn: number;
  let tokensOut: number;
  if (hasActual) {
    tokensIn = totalTokensIn;
    tokensOut = totalTokensOut;
  } else {
    const avgDur = avgDurationSec ?? FALLBACK_AVG_DURATION_SEC;
    tokensIn =
      transcriptCount *
      (avgDur * GEMINI_AUDIO_TOKENS_PER_SEC + FALLBACK_PROMPT_TOKENS_PER_CALL);
    tokensOut =
      transcriptCount * Math.round(avgDur * FALLBACK_OUTPUT_TOKENS_PER_SEC);
  }

  const geminiInputUsd = (tokensIn * GEMINI_INPUT_USD_PER_1M) / 1_000_000;
  const geminiOutputUsd = (tokensOut * GEMINI_OUTPUT_USD_PER_1M) / 1_000_000;
  const geminiUsd = geminiInputUsd + geminiOutputUsd;

  const cloudRunUsd =
    CLOUD_RUN_FIXED_USD_PER_MONTH +
    transcriptCount * CLOUD_RUN_VARIABLE_USD_PER_CALL;
  const supabaseUsd = SUPABASE_FIXED_USD_PER_MONTH;
  const totalUsd = geminiUsd + cloudRunUsd + supabaseUsd;

  return {
    source: hasActual ? "actual" : "estimate",
    transcriptCount,
    tokensIn,
    tokensOut,
    geminiUsd: round3(geminiUsd),
    geminiInputUsd: round3(geminiInputUsd),
    geminiOutputUsd: round3(geminiOutputUsd),
    cloudRunUsd: round2(cloudRunUsd),
    supabaseUsd: round2(supabaseUsd),
    totalUsd: round2(totalUsd),
    totalJpy: Math.round(totalUsd * USD_TO_JPY),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
