// Roots の「種別」select の value → 日本語ラベルのマスタ。
// 拡張が recordings.call_type に raw value を保存し、表示時にここでラベル化する。

export const CALL_TYPE_LABELS: Record<string, string> = {
  talk_recv: "受電会話",
  talk_call: "掛電会話",
  call: "callのみ",
  rec: "留守電",
  absent: "本人不在",
  discon: "不通",
  mail: "メール",
  line_recv: "LINE受",
  line_out: "LINE発",
  letter_postcard: "手紙・はがき",
  voice: "お声ハガキ",
  fax: "FAX",
  misc: "その他",
};

/** 集計・フィルタで主に使う「会話あり」の種別 */
export const CONVERSATION_CALL_TYPES = ["talk_recv", "talk_call"] as const;

export function callTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return CALL_TYPE_LABELS[value] ?? value;
}

/** バッジ色: 受電=緑系 / 掛電=淡桜系 / その他=淡緑（ブランド統一） */
export function callTypeBadgeClass(value: string | null | undefined): string {
  if (value === "talk_recv") return "bg-brand-soft text-brand-green";
  if (value === "talk_call") return "bg-brand-ssoft text-brand-sakura";
  if (!value) return "bg-brand-soft text-brand-sub";
  return "bg-brand-soft text-brand-sub";
}
