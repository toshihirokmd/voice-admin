"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateTodayReport } from "../actions";

interface Props {
  variant?: "primary" | "secondary";
  label?: string;
}

export function GenerateReportButton({
  variant = "primary",
  label = "今日のレポートを生成",
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await generateTodayReport();
      if (result?.ok === false) {
        setError(result.message);
      } else if (result?.ok === true) {
        setInfo(result.message);
        router.refresh();
      }
    });
  }

  const baseCls =
    variant === "primary"
      ? "bg-brand-green text-white rounded-xl font-bold hover:bg-brand-dark"
      : "bg-white border border-brand-border text-brand-sub hover:bg-brand-soft rounded-lg font-medium";

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm transition ${baseCls} ${
          isPending ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {isPending && (
          <span className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        )}
        {isPending ? "生成中…（30秒程度）" : label}
      </button>
      {error && <p className="text-xs text-brand-sakura">{error}</p>}
      {info && <p className="text-xs text-brand-green">{info}</p>}
    </div>
  );
}
