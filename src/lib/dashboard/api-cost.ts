/**
 * API 費用の概算。Vertex AI Gemini 2.5 Flash の従量課金、Cloud Run の
 * 最小インスタンス費、Supabase Pro 固定費の合計をざっくり出す。
 *
 * 用途は「月次費用がいつもより跳ねていないか」を見るトレンド指標。
 * 厳密な実費は GCP Billing で確認すること。
 */

// 2026-05 時点の単価。変更があれば調整する。
const GEMINI_INPUT_USD_PER_1M = 0.075; // input tokens (audio + prompt)
const GEMINI_OUTPUT_USD_PER_1M = 0.3; // output tokens (transcript + summary)
// 1 通話あたりのトークン推定: 2 分音声 ≒ 5000 input + 800 output
const EST_INPUT_TOKENS_PER_CALL = 5000;
const EST_OUTPUT_TOKENS_PER_CALL = 800;

// Cloud Run (voice-finalize) の固定費。min-instances=1, 1CPU, 1Gi。
const CLOUD_RUN_FIXED_USD_PER_MONTH = 8;
// 1 通話 finalize あたりの可変費 (concurrency * cpu-seconds)
const CLOUD_RUN_VARIABLE_USD_PER_CALL = 0.002;

// Supabase Pro 固定費（既に契約済み前提）
const SUPABASE_FIXED_USD_PER_MONTH = 25;

// 円換算レート（おおまかな目安）。為替変動の影響を切り分けるため定数化。
const USD_TO_JPY = 155;

export interface ApiCostEstimate {
  transcriptCount: number;
  geminiUsd: number;
  cloudRunUsd: number;
  supabaseUsd: number;
  totalUsd: number;
  totalJpy: number;
}

export function estimateApiCost(transcriptCount: number): ApiCostEstimate {
  const geminiInputUsd =
    (transcriptCount * EST_INPUT_TOKENS_PER_CALL * GEMINI_INPUT_USD_PER_1M) /
    1_000_000;
  const geminiOutputUsd =
    (transcriptCount * EST_OUTPUT_TOKENS_PER_CALL * GEMINI_OUTPUT_USD_PER_1M) /
    1_000_000;
  const geminiUsd = geminiInputUsd + geminiOutputUsd;
  const cloudRunUsd =
    CLOUD_RUN_FIXED_USD_PER_MONTH +
    transcriptCount * CLOUD_RUN_VARIABLE_USD_PER_CALL;
  const supabaseUsd = SUPABASE_FIXED_USD_PER_MONTH;
  const totalUsd = geminiUsd + cloudRunUsd + supabaseUsd;
  return {
    transcriptCount,
    geminiUsd: round2(geminiUsd),
    cloudRunUsd: round2(cloudRunUsd),
    supabaseUsd: round2(supabaseUsd),
    totalUsd: round2(totalUsd),
    totalJpy: Math.round(totalUsd * USD_TO_JPY),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
