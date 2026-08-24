export type Evaluation = {
  direction?: "inbound" | "outbound" | "unknown";
  problem_depth: number;
  problem_note: string;
  relationship: number;
  relationship_note: string;
  value_delivery: number;
  value_note: string;
  good_point?: string; // v2: 一番良かった点（褒めの主役）
};

const LBL = {
  problem_depth: ["用件のみ", "症状・事実まで", "背景・生活まで聞けた", "願望・価値観まで"],
  relationship: ["事務的", "軽い世間話", "個人的な話題まで", "プライベートな打ち明けまで"],
  value_delivery: ["価値に触れず（事務のみ）", "表面的な指示どまり", "理由つきで説明", "個別化して価値を届けた"],
} as const;

const JP = { problem_depth: "悩みの深さ", relationship: "関係の距離", value_delivery: "商品価値" };

export function renderEvaluation(e: Evaluation) {
  return (["problem_depth", "relationship", "value_delivery"] as const).map((k) => ({
    axis: JP[k],
    label: LBL[k][Math.max(0, Math.min(3, e[k] ?? 0))],
    note: (e as any)[k.split("_")[0] + "_note"] || "-",
  }));
}
