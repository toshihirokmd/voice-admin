// Display master for proposal items. Must stay in sync with the extension's
// extension/src/content/proposal/items.ts.

export type ProposalItemDef = {
  key: string;
  label: string;
};

export const PROPOSAL_ITEMS: ProposalItemDef[] = [
  { key: "kyanshime",        label: "キャン止め" },
  { key: "teiki_hikiage",    label: "定期引上" },
  { key: "zoryo",            label: "増量" },
  { key: "cross",            label: "クロス" },
  { key: "kure_kirikae",     label: "クレ切り替え" },
  { key: "horiokoshi",       label: "掘り起こし" },
  { key: "ganbo",            label: "願望" },
  { key: "nayami",           label: "悩み" },
  { key: "private",          label: "プライベート" },
  { key: "tasha_riyo",       label: "他社利用" },
  { key: "shokai",           label: "紹介" },
  { key: "omatome",          label: "おまとめ" },
  { key: "teian_henko",      label: "提案 ⇒ 変更" },
  { key: "nenkan_course",    label: "年間コース" },
  { key: "free1",            label: "フリー1" },
  { key: "free2",            label: "フリー2" },
  { key: "secret_course",    label: "シークレットコース" },
  { key: "shohin_joho",      label: "商品情報" },
  { key: "campaign1",        label: "キャンペーン1" },
  { key: "campaign2",        label: "キャンペーン2" },
  { key: "shimei",           label: "指名" },
  { key: "hiroiage",         label: "拾い上げ" },
  { key: "tokutoku",         label: "トクトク(医薬品)" },
  { key: "after_yakusoku",   label: "アフター約束" },
  { key: "keizoku_tokuten",  label: "継続特典" },
];

export function valueLabel(value: unknown): { text: string; cls: string } {
  if (value === "1") return { text: "成功", cls: "bg-green-100 text-green-800 border-green-300" };
  if (value === "0") return { text: "提案のみ", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  return { text: "-", cls: "bg-gray-50 text-gray-400 border-gray-200" };
}
