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
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "bg-white text-blue-700 border border-blue-300 hover:bg-blue-50";

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition ${baseCls} ${
          isPending ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        {isPending && (
          <span className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        )}
        {isPending ? "生成中…（30秒程度）" : label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {info && <p className="text-xs text-emerald-700">{info}</p>}
    </div>
  );
}
