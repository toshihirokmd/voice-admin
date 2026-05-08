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
    <div className="mb-4 bg-white rounded shadow">
      <details open={activeCount > 0} className="group">
        <summary className="cursor-pointer select-none px-4 py-3 flex items-center gap-2 hover:bg-gray-50 rounded-t">
          <span className="text-sm font-medium">🔍 検索フィルター</span>
          {activeCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300">
              {activeCount}件適用中
            </span>
          )}
          <span className="ml-auto text-xs text-gray-400 group-open:hidden">▼ 開く</span>
          <span className="ml-auto text-xs text-gray-400 hidden group-open:inline">▲ 閉じる</span>
        </summary>

        <form action="/recordings" method="get" className="px-4 pb-4 pt-2 space-y-4 text-sm border-t">
          {/* Row 1: text inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">タイトル・要約検索</span>
              <input
                name="q"
                defaultValue={filter.query ?? ""}
                placeholder="例: 解約 / トメテル など"
                className="px-2 py-1.5 border rounded"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">対応者メール（部分一致）</span>
              <input
                name="operator"
                defaultValue={filter.operator ?? ""}
                placeholder="kamada など"
                className="px-2 py-1.5 border rounded"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">受注番号（部分一致）</span>
              <input
                name="order_number"
                defaultValue={filter.orderNumber ?? ""}
                placeholder="208114899 など"
                className="px-2 py-1.5 border rounded"
              />
            </label>
          </div>

          {/* Row 2: date range + statuses */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">録音日 (開始)</span>
              <input
                type="date"
                name="start_date"
                defaultValue={filter.startDate ?? ""}
                className="px-2 py-1.5 border rounded"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">録音日 (終了)</span>
              <input
                type="date"
                name="end_date"
                defaultValue={filter.endDate ?? ""}
                className="px-2 py-1.5 border rounded"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-600">ステータス（複数選択可）</span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {STATUS_OPTIONS.map((s) => {
                  const checked = statusFilter.includes(s.value);
                  return (
                    <label
                      key={s.value}
                      className={`flex items-center gap-1 px-2 py-1 border rounded cursor-pointer text-xs ${
                        checked
                          ? "bg-blue-100 border-blue-300 text-blue-800"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="status"
                        value={s.value}
                        defaultChecked={checked}
                        className="accent-blue-600"
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
          <div className="flex flex-wrap gap-2 justify-end pt-2 border-t">
            <Link
              href="/recordings"
              className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50"
            >
              クリア
            </Link>
            <Link
              href={csvHref}
              className="px-3 py-1.5 text-xs border border-emerald-300 bg-emerald-50 text-emerald-800 rounded hover:bg-emerald-100"
            >
              📥 CSV ダウンロード
            </Link>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
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
    blue: { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800", accent: "accent-blue-600" },
    emerald: { bg: "bg-emerald-100", border: "border-emerald-300", text: "text-emerald-800", accent: "accent-emerald-600" },
    green: { bg: "bg-green-100", border: "border-green-300", text: "text-green-800", accent: "accent-green-600" },
  }[color];

  return (
    <details open={selected.length > 0}>
      <summary className="cursor-pointer text-sm text-gray-700 hover:text-gray-900 select-none">
        {title}（複数選択可）
        {badge && <span className="ml-2 text-xs text-blue-600">{badge}</span>}
      </summary>
      <div className="mt-2 flex items-center gap-4 text-xs">
        <span className="text-gray-600">マッチ条件:</span>
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
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {items.map((item) => {
          const checked = selected.includes(item.value);
          return (
            <label
              key={item.value}
              className={`flex items-center gap-1.5 px-2 py-1 border rounded cursor-pointer text-xs ${
                checked ? `${palette.bg} ${palette.border} ${palette.text}` : "border-gray-200 hover:bg-gray-50"
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
          <p className="col-span-full text-xs text-gray-500">候補がまだありません。</p>
        )}
      </div>
    </details>
  );
}
