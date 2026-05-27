/**
 * API 費用の概算。Vertex AI Gemini 2.5 Flash の従量課金、Cloud Run の
 * 最小インスタンス費、Supabase Pro 固定費の合計をざっくり出す。
 *
 * 用途は「月次費用がいつもより跳ねていないか」を見るトレンド指標。
 * 厳密な実費は GCP Billing で確認すること。
 *
 * 注意:
 * - Gemini 費用は transcriptCount × avgDurationSec で動的算出（音声トークン課金）
 * - Cloud Run / Supabase は月額固定費なので期間フィルタの影響を受けない
 */

// Gemini 2.5 Flash の単価 (2026-05 時点)
// 音声入力は token 化レートが 32 tokens/秒
const GEMINI_AUDIO_TOKENS_PER_SEC = 32;
const GEMINI_AUDIO_INPUT_USD_PER_1M = 0.3; // 音声入力
const GEMINI_TEXT_INPUT_USD_PER_1M = 0.075; // プロンプト/システム
const GEMINI_OUTPUT_USD_PER_1M = 0.3; // 書き起こし + 要約
// 通話 1 件あたりプロンプトオーバーヘッド（システム指示等）
const PROMPT_TOKENS_PER_CALL = 1500;
// 出力 token 推定: 日本語の書き起こし ≒ 5 tokens/秒
const OUTPUT_TOKENS_PER_SEC = 5;
// 平均通話時間が取れない場合の fallback (秒)
const FALLBACK_AVG_DURATION_SEC = 180;

// Cloud Run (voice-finalize) の固定費 (min-instances=1, 1CPU, 1Gi)
const CLOUD_RUN_FIXED_USD_PER_MONTH = 8;
// 1 通話 finalize あたりの可変費 (cpu-seconds)
const CLOUD_RUN_VARIABLE_USD_PER_CALL = 0.002;

// Supabase Pro 固定費（既に契約済み前提）
const SUPABASE_FIXED_USD_PER_MONTH = 25;

// 円換算レート（おおまかな目安）。為替変動の影響を切り分けるため定数化。
const USD_TO_JPY = 155;

export interface ApiCostEstimate {
  transcriptCount: number;
  avgDurationSec: number;
  geminiUsd: number;
  geminiAudioUsd: number;
  geminiTextUsd: number;
  geminiOutputUsd: number;
  cloudRunUsd: number;
  supabaseUsd: number;
  totalUsd: number;
  totalJpy: number;
}

export function estimateApiCost(
  transcriptCount: number,
  avgDurationSec: number | null
): ApiCostEstimate {
  const avgDur = avgDurationSec ?? FALLBACK_AVG_DURATION_SEC;
  const audioTokensPerCall = avgDur * GEMINI_AUDIO_TOKENS_PER_SEC;
  const outputTokensPerCall = avgDur * OUTPUT_TOKENS_PER_SEC;

  const geminiAudioUsd =
    (transcriptCount * audioTokensPerCall * GEMINI_AUDIO_INPUT_USD_PER_1M) /
    1_000_000;
  const geminiTextUsd =
    (transcriptCount * PROMPT_TOKENS_PER_CALL * GEMINI_TEXT_INPUT_USD_PER_1M) /
    1_000_000;
  const geminiOutputUsd =
    (transcriptCount * outputTokensPerCall * GEMINI_OUTPUT_USD_PER_1M) /
    1_000_000;
  const geminiUsd = geminiAudioUsd + geminiTextUsd + geminiOutputUsd;

  const cloudRunUsd =
    CLOUD_RUN_FIXED_USD_PER_MONTH +
    transcriptCount * CLOUD_RUN_VARIABLE_USD_PER_CALL;
  const supabaseUsd = SUPABASE_FIXED_USD_PER_MONTH;
  const totalUsd = geminiUsd + cloudRunUsd + supabaseUsd;

  return {
    transcriptCount,
    avgDurationSec: avgDur,
    geminiUsd: round3(geminiUsd),
    geminiAudioUsd: round3(geminiAudioUsd),
    geminiTextUsd: round3(geminiTextUsd),
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
