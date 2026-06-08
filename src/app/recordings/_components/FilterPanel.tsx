import Link from "next/link";
import { PROPOSAL_ITEMS } from "@/lib/proposal/items";
import type { Product } from "@/lib/products/queries";
import {
  countActiveFilters,
  type RecordingsFilter,
} from "@/lib/recordings/queries";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "transcribed", label: "完了 (transcribed)" },
  { value: "recording", label: "録音中 (recording)" },
  { value: "failed", label: "失敗 (failed)" },
  { value: "transcribed_no_audio", label: "書き起こし済(音声なし)" },
  { value: "ul_done_transcribe_failed", label: "アップロード済・書き起こし失敗" },
  { value: "finalize_crashed", label: "finalize crash" },
];

type Props = {
  filter: RecordingsFilter;
  productMaster: Product[];
  productGroupMaster: string[];
  csvHref: string;
};

export function FilterPanel({ filter, productMaster, productGroupMaster, csvHref }: Props) {
  const activeCount = countActiveFilters(filter);
  const successFilter = filter.successKeys ?? [];
  const productFilter = filter.products ?? [];
  const productGroupFilter = filter.productGroups ?? [];
  const statusFilter = filter.statuses ?? [];

  return (
    <div className="bg-white border border-brand-border rounded-card shadow-soft">
      <details open={activeCount > 0} className="group">
        <summary className="cursor-pointer select-none px-5 py-4 flex items-center gap-2 hover:bg-brand-soft/50 rounded-card">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
            🔍
          </span>
          <span className="font-bold text-brand-green">検索フィルター</span>
          {activeCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-brand-soft text-brand-green">
              {activeCount}件適用中
            </span>
          )}
          <span className="ml-auto text-xs text-brand-sub group-open:hidden">▼ 開く</span>
          <span className="ml-auto text-xs text-brand-sub hidden group-open:inline">▲ 閉じる</span>
        </summary>

        <form action="/recordings" method="get" className="px-5 pb-5 pt-2 space-y-4 text-sm border-t border-brand-border">
          {/* Row 1: text inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-brand-sub">タイトル・要約検索</span>
              <input
                name="q"
                defaultValue={filter.query ?? ""}
                placeholder="例: 解約 / トメテル など"
                className="px-3 py-2 bg-white border border-brand-border rounded-lg"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-brand-sub">対応者メール（部分一致）</span>
              <input
                name="operator"
                defaultValue={filter.operator ?? ""}
                placeholder="kamada など"
                className="px-3 py-2 bg-white border border-brand-border rounded-lg"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-brand-sub">受注番号（部分一致）</span>
              <input
                name="order_number"
                defaultValue={filter.orderNumber ?? ""}
                placeholder="208114899 など"
                className="px-3 py-2 bg-white border border-brand-border rounded-lg"
              />
            </label>
          </div>

          {/* Row 2: date range + statuses */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-brand-sub">録音日 (開始)</span>
              <input
                type="date"
                name="start_date"
                defaultValue={filter.startDate ?? ""}
                className="px-3 py-2 bg-white border border-brand-border rounded-lg"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-brand-sub">録音日 (終了)</span>
              <input
                type="date"
                name="end_date"
                defaultValue={filter.endDate ?? ""}
                className="px-3 py-2 bg-white border border-brand-border rounded-lg"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-brand-sub">ステータス（複数選択可）</span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {STATUS_OPTIONS.map((s) => {
                  const checked = statusFilter.includes(s.value);
                  return (
                    <label
                      key={s.value}
                      className={`flex items-center gap-1 px-2 py-1 border rounded-full cursor-pointer text-xs ${
                        checked
                          ? "bg-brand-soft border-brand-leaf text-brand-green font-bold"
                          : "border-brand-border text-brand-sub hover:bg-brand-soft"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="status"
                        value={s.value}
                        defaultChecked={checked}
                        className="accent-brand-green"
                      />
                      <span>{s.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Multi-select sections (proposal/products/groups) */}
          <MultiSection
            title="商品で絞り込み"
            badge={
              productFilter.length > 0
                ? `${productFilter.length}項目選択中（${filter.productMatch === "or" ? "OR" : "AND"}）`
                : null
            }
            matchName="product_match"
            matchValue={filter.productMatch ?? "and"}
            checkboxName="product"
            items={productMaster.map((p) => ({ value: p.name, label: p.name }))}
            selected={productFilter}
            color="blue"
          />

          <MultiSection
            title="商品グループで絞り込み"
            badge={
              productGroupFilter.length > 0
                ? `${productGroupFilter.length}項目選択中（${filter.productGroupMatch === "or" ? "OR" : "AND"}）`
                : null
            }
            matchName="product_group_match"
            matchValue={filter.productGroupMatch ?? "and"}
            checkboxName="product_group"
            items={productGroupMaster.map((g) => ({ value: g, label: g }))}
            selected={productGroupFilter}
            color="emerald"
            note="紐付け未実施の通話はこの条件では検索できません"
          />

          <MultiSection
            title="提案成功で絞り込み"
            badge={
              successFilter.length > 0
                ? `${successFilter.length}項目選択中（${filter.successMatch === "or" ? "OR" : "AND"}）`
                : null
            }
            matchName="match"
            matchValue={filter.successMatch ?? "and"}
            checkboxName="success"
            items={PROPOSAL_ITEMS.map((p) => ({ value: p.key, label: p.label }))}
            selected={successFilter}
            color="green"
          />

          {/* Buttons */}
          <div className="flex flex-wrap gap-2 justify-end pt-2 border-t border-brand-border">
            <Link
              href="/recordings"
              className="px-4 py-2 text-xs bg-white border border-brand-border rounded-lg text-brand-sub hover:bg-brand-soft"
            >
              クリア
            </Link>
            <Link
              href={csvHref}
              className="px-4 py-2 text-xs border border-brand-border bg-brand-soft text-brand-green font-bold rounded-lg hover:bg-brand-leaf/25"
            >
              📥 CSV ダウンロード
            </Link>
            <button
              type="submit"
              className="px-5 py-2 text-xs bg-brand-green text-white rounded-xl font-bold hover:bg-brand-dark transition"
            >
              この条件で検索
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}

type MultiSectionProps = {
  title: string;
  badge: string | null;
  matchName: string;
  matchValue: "and" | "or";
  checkboxName: string;
  items: { value: string; label: string }[];
  selected: string[];
  color: "blue" | "emerald" | "green";
  note?: string;
};

function MultiSection({
  title,
  badge,
  matchName,
  matchValue,
  checkboxName,
  items,
  selected,
  color,
  note,
}: MultiSectionProps) {
  const palette = {
    blue: { bg: "bg-brand-soft", border: "border-brand-leaf", text: "text-brand-green font-bold", accent: "accent-brand-green" },
    emerald: { bg: "bg-brand-soft", border: "border-brand-leaf", text: "text-brand-green font-bold", accent: "accent-brand-green" },
    green: { bg: "bg-brand-soft", border: "border-brand-leaf", text: "text-brand-green font-bold", accent: "accent-brand-green" },
  }[color];

  return (
    <details open={selected.length > 0}>
      <summary className="cursor-pointer text-sm text-brand-ink hover:text-brand-green select-none">
        {title}（複数選択可）
        {badge && <span className="ml-2 text-xs text-brand-green font-bold">{badge}</span>}
      </summary>
      <div className="mt-2 flex items-center gap-4 text-xs">
        <span className="text-brand-sub">マッチ条件:</span>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name={matchName}
            value="and"
            defaultChecked={matchValue === "and"}
            className={palette.accent}
          />
          <span>AND（全部含む）</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name={matchName}
            value="or"
            defaultChecked={matchValue === "or"}
            className={palette.accent}
          />
          <span>OR（いずれか含む）</span>
        </label>
      </div>
      {note && <p className="mt-1 text-xs text-brand-sub">{note}</p>}
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {items.map((item) => {
          const checked = selected.includes(item.value);
          return (
            <label
              key={item.value}
              className={`flex items-center gap-1.5 px-2 py-1 border rounded-full cursor-pointer text-xs ${
                checked ? `${palette.bg} ${palette.border} ${palette.text}` : "border-brand-border text-brand-sub hover:bg-brand-soft"
              }`}
            >
              <input
                type="checkbox"
                name={checkboxName}
                value={item.value}
                defaultChecked={checked}
                className={palette.accent}
              />
              <span>{item.label}</span>
            </label>
          );
        })}
        {items.length === 0 && (
          <p className="col-span-full text-xs text-brand-sub">候補がまだありません。</p>
        )}
      </div>
    </details>
  );
}
