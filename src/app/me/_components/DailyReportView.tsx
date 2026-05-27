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
    bg: "from-blue-50 to-blue-100",
    border: "border-blue-200",
    text: "text-blue-900",
  },
  {
    key: "good_phrase",
    title: "印象的なフレーズ",
    emoji: "♪",
    bg: "from-violet-50 to-violet-100",
    border: "border-violet-200",
    text: "text-violet-900",
  },
  {
    key: "positive_voc",
    title: "顧客の喜びの声",
    emoji: "♥",
    bg: "from-rose-50 to-rose-100",
    border: "border-rose-200",
    text: "text-rose-900",
  },
  {
    key: "improvement_voc",
    title: "商品改善のヒント",
    emoji: "!",
    bg: "from-amber-50 to-amber-100",
    border: "border-amber-200",
    text: "text-amber-900",
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
    <section className="bg-white border rounded-lg p-4 space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-semibold">今日のレポート</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            生成 {jstStr} / tokens {(report.tokens_in / 1000).toFixed(1)}k+
            {(report.tokens_out / 1000).toFixed(1)}k
          </span>
          <GenerateReportButton variant="secondary" label="再生成（〜¥0.2）" />
        </div>
      </div>

      {report.overall_comment && (
        <div className="bg-gray-50 border-l-4 border-gray-300 p-3 text-sm leading-relaxed">
          {report.overall_comment}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => {
          const list = report.highlights[cat.key] ?? [];
          return (
            <div
              key={cat.key}
              className={`bg-gradient-to-br ${cat.bg} border ${cat.border} rounded-xl p-3`}
            >
              <div
                className={`text-xs font-semibold ${cat.text} uppercase tracking-wider flex items-center gap-1`}
              >
                <span>{cat.emoji}</span>
                {cat.title}
                <span className="ml-auto text-xs opacity-60">{list.length}件</span>
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-gray-400 mt-2">該当なし</p>
              ) : (
                <ul className="space-y-2 mt-2">
                  {list.map((h, idx) => (
                    <li
                      key={`${cat.key}-${idx}-${h.session_id}`}
                      className="bg-white/70 rounded p-2 text-xs"
                    >
                      <Link
                        href={`/recordings/${h.session_id}`}
                        className={`font-semibold ${cat.text} hover:underline`}
                      >
                        {h.title}
                      </Link>
                      <blockquote
                        className={`mt-1 pl-2 border-l-2 ${cat.border} text-gray-700 italic`}
                      >
                        「{h.quote}」
                      </blockquote>
                      <p className="text-gray-500 mt-1">{h.comment}</p>
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
