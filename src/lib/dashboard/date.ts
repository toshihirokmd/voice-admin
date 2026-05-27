/**
 * JST (Asia/Tokyo) を業務基準のタイムゾーンとして扱うためのヘルパー。
 * server runtime は UTC、業務日付は JST という前提で、各種「今日」「今月初日」
 * を **UTC ISO 文字列** で返す。Supabase クエリの gte()/lt() にそのまま渡せる。
 */

const tokyoYmdFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** JST の今日 00:00 を UTC ISO 文字列で返す */
export function jstTodayStartIso(): string {
  const jstDate = tokyoYmdFmt.format(new Date());
  return new Date(`${jstDate}T00:00:00+09:00`).toISOString();
}

/** JST の今日 00:00 を YYYY-MM-DD 形式で返す（URL の start_date/end_date 用） */
export function jstTodayYmd(): string {
  return tokyoYmdFmt.format(new Date());
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

/** YYYY-MM-DD (JST) を JST 00:00 として UTC ISO に変換 */
export function jstYmdToIso(ymd: string, endOfDay = false): string {
  const suffix = endOfDay ? "T23:59:59.999+09:00" : "T00:00:00+09:00";
  return new Date(`${ymd}${suffix}`).toISOString();
}

/** UTC ISO を JST の YYYY-MM-DD に変換 */
export function isoToJstYmd(iso: string): string {
  return tokyoYmdFmt.format(new Date(iso));
}

export type PeriodPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "last_7_days"
  | "last_30_days"
  | "custom";

export interface PeriodRange {
  /** "今月" など UI 表示用ラベル */
  label: string;
  /** YYYY-MM-DD (JST) */
  startYmd: string;
  /** YYYY-MM-DD (JST) — 範囲の最終日 (inclusive) */
  endYmd: string;
  /** UTC ISO — start 日の JST 00:00 */
  startIso: string;
  /** UTC ISO — end 日の翌日 JST 00:00 (Supabase の lt() に渡す = exclusive end) */
  endExclusiveIso: string;
}

const PRESET_LABEL: Record<Exclude<PeriodPreset, "custom">, string> = {
  today: "今日",
  yesterday: "昨日",
  this_week: "今週",
  this_month: "今月",
  last_month: "先月",
  last_7_days: "直近7日",
  last_30_days: "直近30日",
};

/**
 * 期間プリセットから日付範囲を JST 基準で構築する。
 * custom の場合は startYmd/endYmd が必須。
 */
export function resolvePeriodRange(
  preset: PeriodPreset,
  customStartYmd?: string,
  customEndYmd?: string
): PeriodRange {
  if (preset === "custom") {
    const s = customStartYmd ?? jstMonthStartYmd();
    const e = customEndYmd ?? jstTodayYmd();
    return buildRange("カスタム", s, e);
  }

  const todayYmd = jstTodayYmd();
  const [y, m, d] = todayYmd.split("-").map((n) => parseInt(n, 10));

  switch (preset) {
    case "today":
      return buildRange(PRESET_LABEL.today, todayYmd, todayYmd);
    case "yesterday": {
      const ymd = addDaysYmd(todayYmd, -1);
      return buildRange(PRESET_LABEL.yesterday, ymd, ymd);
    }
    case "this_week": {
      // 週は月曜始まり (JST)
      const dow = new Date(`${todayYmd}T00:00:00+09:00`).getUTCDay(); // 0=Sun..6=Sat (JST 00:00 ≒ UTC 15:00 前日)
      // JST 月曜のオフセット
      const jstDow = dowJst(todayYmd); // 0=Mon..6=Sun
      const start = addDaysYmd(todayYmd, -jstDow);
      return buildRange(PRESET_LABEL.this_week, start, todayYmd);
    }
    case "this_month": {
      const start = `${y}-${pad2(m)}-01`;
      return buildRange(PRESET_LABEL.this_month, start, todayYmd);
    }
    case "last_month": {
      const lastM = m === 1 ? 12 : m - 1;
      const lastY = m === 1 ? y - 1 : y;
      const start = `${lastY}-${pad2(lastM)}-01`;
      // 先月末 = 今月 1 日の前日
      const thisMonthStart = `${y}-${pad2(m)}-01`;
      const end = addDaysYmd(thisMonthStart, -1);
      return buildRange(PRESET_LABEL.last_month, start, end);
    }
    case "last_7_days":
      return buildRange(
        PRESET_LABEL.last_7_days,
        addDaysYmd(todayYmd, -6),
        todayYmd
      );
    case "last_30_days":
      return buildRange(
        PRESET_LABEL.last_30_days,
        addDaysYmd(todayYmd, -29),
        todayYmd
      );
  }
  // ts: never。fallback for safety
  void d;
  return buildRange(PRESET_LABEL.this_month, jstMonthStartYmd(), todayYmd);
}

function buildRange(
  label: string,
  startYmd: string,
  endYmd: string
): PeriodRange {
  const startIso = jstYmdToIso(startYmd, false);
  // end exclusive = endYmd + 1day の JST 00:00
  const endExclusiveYmd = addDaysYmd(endYmd, 1);
  const endExclusiveIso = jstYmdToIso(endExclusiveYmd, false);
  return { label, startYmd, endYmd, startIso, endExclusiveIso };
}

function addDaysYmd(ymd: string, delta: number): string {
  const dt = new Date(`${ymd}T00:00:00+09:00`);
  dt.setUTCDate(dt.getUTCDate() + delta);
  return tokyoYmdFmt.format(dt);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** JST の曜日: 0=月..6=日 */
function dowJst(ymd: string): number {
  // new Date("2026-05-27T00:00:00+09:00").getUTCDay() は UTC 基準なので JST と異なることあり。
  // YYYY-MM-DD から直接 Zeller 的に計算するのが堅い
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  const dt = Date.UTC(y, m - 1, d); // ローカル無視で UTC 解釈
  const jsDow = new Date(dt).getUTCDay(); // 0=Sun..6=Sat
  return (jsDow + 6) % 7; // 0=Mon..6=Sun
}
