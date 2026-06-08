"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { PeriodPreset } from "@/lib/dashboard/date";

const PRESETS: { key: PeriodPreset; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "this_week", label: "今週" },
  { key: "this_month", label: "今月" },
  { key: "last_month", label: "先月" },
  { key: "last_7_days", label: "直近7日" },
  { key: "last_30_days", label: "直近30日" },
];

interface Props {
  operators: { email: string; displayName: string }[];
  currentPreset: PeriodPreset;
  currentOperator: string;
  currentStartYmd: string;
  currentEndYmd: string;
}

export function FilterBar({
  operators,
  currentPreset,
  currentOperator,
  currentStartYmd,
  currentEndYmd,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/?${qs}` : "/");
    });
  }

  function selectPreset(p: PeriodPreset) {
    if (p === "custom") {
      updateParams({ period: "custom" });
    } else {
      updateParams({ period: p, start: null, end: null });
    }
  }

  const showCustomInputs = currentPreset === "custom";

  return (
    <div
      className={`bg-white border border-brand-border rounded-card p-3 flex flex-wrap items-center gap-3 sticky top-0 z-10 shadow-soft ${
        isPending ? "opacity-60" : ""
      }`}
    >
      {/* 期間プリセット */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold text-brand-sub mr-1">期間:</span>
        {PRESETS.map((p) => {
          const active = currentPreset === p.key;
          return (
            <button
              key={p.key}
              onClick={() => selectPreset(p.key)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition font-bold ${
                active
                  ? "bg-brand-green text-white border-brand-green"
                  : "bg-white text-brand-sub border-brand-border hover:bg-brand-soft"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        <button
          onClick={() => selectPreset("custom")}
          className={`text-xs px-3 py-1.5 rounded-lg border transition font-bold ${
            currentPreset === "custom"
              ? "bg-brand-green text-white border-brand-green"
              : "bg-white text-brand-sub border-brand-border hover:bg-brand-soft"
          }`}
        >
          カスタム
        </button>
      </div>

      {showCustomInputs && (
        <div className="flex items-center gap-1 text-xs">
          <input
            type="date"
            value={currentStartYmd}
            max={currentEndYmd}
            onChange={(e) =>
              updateParams({ period: "custom", start: e.target.value })
            }
            className="border border-brand-border rounded-lg px-2 py-1.5 bg-white"
          />
          <span className="text-brand-sub">〜</span>
          <input
            type="date"
            value={currentEndYmd}
            min={currentStartYmd}
            onChange={(e) =>
              updateParams({ period: "custom", end: e.target.value })
            }
            className="border border-brand-border rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
      )}

      <div className="flex-1" />

      {/* オペレーター */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-brand-sub">オペレーター:</span>
        <select
          value={currentOperator}
          onChange={(e) =>
            updateParams({ operator: e.target.value || null })
          }
          className="text-xs border border-brand-border rounded-lg px-2 py-1.5 bg-white text-brand-ink"
        >
          <option value="">全員</option>
          {operators.map((op) => (
            <option key={op.email} value={op.email}>
              {op.displayName}
            </option>
          ))}
        </select>
        {(currentOperator || currentPreset !== "this_month") && (
          <button
            onClick={() =>
              startTransition(() => {
                router.push("/");
              })
            }
            className="text-xs px-3 py-1.5 rounded-lg border border-brand-border bg-white text-brand-sub hover:bg-brand-ssoft hover:text-brand-sakura transition"
          >
            リセット
          </button>
        )}
      </div>
    </div>
  );
}
