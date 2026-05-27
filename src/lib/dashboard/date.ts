/**
 * JST (Asia/Tokyo) を業務基準のタイムゾーンとして扱うためのヘルパー。
 * server runtime は UTC、業務日付は JST という前提で、各種「今日」「今月初日」
 * を **UTC ISO 文字列** で返す。Supabase クエリの gte() にそのまま渡せる。
 */

/** JST の今日 00:00 を UTC ISO 文字列で返す */
export function jstTodayStartIso(): string {
  // 例: JST が 2026-05-27 のとき "2026-05-26T15:00:00.000Z"
  const jstDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${jstDate}T00:00:00+09:00`).toISOString();
}

/** JST の今日 00:00 を YYYY-MM-DD 形式で返す（URL の start_date/end_date 用） */
export function jstTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** JST の今月 1 日 00:00 を UTC ISO 文字列で返す */
export function jstMonthStartIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date()); // "2026-05"
  return new Date(`${parts}-01T00:00:00+09:00`).toISOString();
}

/** JST の今月 1 日を YYYY-MM-DD 形式で返す */
export function jstMonthStartYmd(): string {
  return jstMonthStartIso().slice(0, 10);
}
