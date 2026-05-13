/**
 * CSV serialization for the /recordings export endpoint.
 *
 * Output is UTF-8 with BOM so Excel auto-detects encoding. Array fields
 * (商品 / 商品グループ / 受注番号 / 提案成功) are flattened with `;` so each
 * row stays a single Excel cell.
 */
import { PROPOSAL_ITEMS } from "@/lib/proposal/items";
import type { Recording, LinkedOrderSummary } from "@/lib/recordings/queries";

const PROPOSAL_LABEL_BY_KEY = new Map(PROPOSAL_ITEMS.map((p) => [p.key, p.label]));

const HEADERS = [
  "録音日時(JST)",
  "通話時間(秒)",
  "セッションID",
  "対応者メール",
  "対応者表示名",
  "タイトル",
  "要約",
  "書き起こし全文",
  "商品",
  "商品グループ",
  "受注番号",
  "提案成功",
  "ステータス",
];

export type CsvRowInput = {
  recording: Recording;
  proposalKeys: string[];
  linkedOrders: LinkedOrderSummary | undefined;
  displayName: string;
};

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDateTimeJst(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ja-JP", {
    hour12: false,
    timeZone: "Asia/Tokyo",
  });
}

function flatten(arr: readonly string[] | null | undefined): string {
  return (arr ?? []).filter(Boolean).join(";");
}

// Excel など各種 CSV reader が確実に1セル内に収まるよう、改行は LF に正規化
// (CR を除去し、ダブル空行を抑制)。csvEscape が自動でダブルクォート囲みするので
// 内部改行はセル内改行として正しく扱われる。
function preserveFulltext(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n");
}

export function buildRecordingsCsv(rows: CsvRowInput[]): string {
  const lines: string[] = [];
  lines.push(HEADERS.map(csvEscape).join(","));

  for (const { recording: r, proposalKeys, linkedOrders, displayName } of rows) {
    const transcript = r.transcripts?.[0];
    const proposalLabels = proposalKeys.map(
      (k) => PROPOSAL_LABEL_BY_KEY.get(k) ?? k
    );
    const cells = [
      formatDateTimeJst(r.started_at),
      r.duration_sec ?? "",
      r.session_id,
      r.operator_email ?? "",
      displayName,
      transcript?.title ?? "",
      preserveFulltext(transcript?.summary),
      preserveFulltext(transcript?.merged_text),
      flatten(transcript?.products),
      flatten(linkedOrders?.productGroups),
      flatten(linkedOrders?.orderNumbers),
      flatten(proposalLabels),
      r.status,
    ];
    lines.push(cells.map(csvEscape).join(","));
  }

  return lines.join("\r\n");
}

export function csvFilename(now: Date = new Date()): string {
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const yyyy = jst.getFullYear();
  const mm = String(jst.getMonth() + 1).padStart(2, "0");
  const dd = String(jst.getDate()).padStart(2, "0");
  const hh = String(jst.getHours()).padStart(2, "0");
  const mi = String(jst.getMinutes()).padStart(2, "0");
  return `recordings-${yyyy}${mm}${dd}-${hh}${mi}.csv`;
}
