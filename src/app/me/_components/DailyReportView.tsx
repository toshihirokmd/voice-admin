import Link from "next/link";
import { GenerateReportButton } from "./GenerateReportButton";

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

export interface DailyReport {
  highlights: ReportHighlights;
  overall_comment: string | null;
  generated_at: string;
  tokens_in: number;
  tokens_out: number;
  model: string | null;
}

const CATEGORIES: Array<{
  key: keyof ReportHighlights;
  title: string;
  emoji: string;
  bg: string;
  border: string;
  text: string;
}> = [
  {
    key: "good_handling",
    title: "質の高い対応",
    emoji: "★",
    bg: "bg-brand-soft",
    border: "border-brand-border",
    text: "text-brand-green",
  },
  {
    key: "good_phrase",
    title: "印象的なフレーズ",
    emoji: "♪",
    bg: "bg-brand-soft",
    border: "border-brand-border",
    text: "text-brand-green",
  },
  {
    key: "positive_voc",
    title: "顧客の喜びの声",
    emoji: "♥",
    bg: "bg-brand-ssoft",
    border: "border-brand-border",
    text: "text-brand-sakura",
  },
  {
    key: "improvement_voc",
    title: "商品改善のヒント",
    emoji: "!",
    bg: "bg-brand-soft",
    border: "border-brand-border",
    text: "text-brand-green",
  },
];

interface Props {
  report: DailyReport;
}

export function DailyReportView({ report }: Props) {
  const generatedAt = new Date(report.generated_at);
  const jstStr = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(generatedAt);

  return (
    <section className="bg-white border border-brand-border rounded-card p-5 shadow-soft space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
            📝
          </span>
          <h2 className="font-bold text-brand-green">今日のレポート</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-brand-sub">
            生成 {jstStr} / tokens {(report.tokens_in / 1000).toFixed(1)}k+
            {(report.tokens_out / 1000).toFixed(1)}k
          </span>
          <GenerateReportButton variant="secondary" label="再生成（〜¥0.2）" />
        </div>
      </div>

      {report.overall_comment && (
        <div className="bg-brand-bg border border-brand-border rounded-xl p-4 text-sm leading-relaxed text-brand-ink">
          {report.overall_comment}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => {
          const list = report.highlights[cat.key] ?? [];
          return (
            <div
              key={cat.key}
              className={`${cat.bg} border ${cat.border} rounded-xl p-3`}
            >
              <div
                className={`text-xs font-bold ${cat.text} tracking-wider flex items-center gap-1`}
              >
                <span>{cat.emoji}</span>
                {cat.title}
                <span className="ml-auto text-xs opacity-60">{list.length}件</span>
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-brand-sub mt-2">該当なし</p>
              ) : (
                <ul className="space-y-2 mt-2">
                  {list.map((h, idx) => (
                    <li
                      key={`${cat.key}-${idx}-${h.session_id}`}
                      className="bg-white/70 rounded-lg p-2 text-xs"
                    >
                      <Link
                        href={`/recordings/${h.session_id}`}
                        className={`font-bold ${cat.text} hover:underline`}
                      >
                        {h.title}
                      </Link>
                      <blockquote
                        className={`mt-1 pl-2 border-l-2 ${cat.border} text-brand-ink italic`}
                      >
                        「{h.quote}」
                      </blockquote>
                      <p className="text-brand-sub mt-1">{h.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
