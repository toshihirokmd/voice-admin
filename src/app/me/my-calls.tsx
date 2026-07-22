"use client";

import { useState } from "react";
import type { MyCall } from "@/lib/me/queries";
import { CopyButton } from "@/app/uploads/copy-button";

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ja-JP", { hour12: false, timeZone: "Asia/Tokyo" });
}

function dur(sec: number | null): string {
  if (sec == null) return "-";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  processing: { label: "処理中", cls: "bg-brand-soft text-brand-sub" },
  transcribed: { label: "完了", cls: "bg-brand-soft text-brand-green" },
  failed: { label: "失敗", cls: "bg-brand-ssoft text-brand-sakura" },
  recording: { label: "録音中", cls: "bg-brand-soft text-brand-sub" },
  aborted: { label: "中断", cls: "bg-brand-soft text-brand-sub" },
};

export function MyCalls({ calls }: { calls: MyCall[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (calls.length === 0) {
    return (
      <p className="text-xs text-brand-sub">まだ通話の記録がありません。</p>
    );
  }

  return (
    <div className="space-y-2">
      {calls.map((c) => {
        const st = STATUS[c.status] ?? { label: c.status, cls: "bg-brand-soft text-brand-sub" };
        const open = openId === c.id;
        const hasText = Boolean(c.summary || c.mergedText);
        const whole = [
          c.title ? `# ${c.title}` : "",
          `通話日: ${fmt(c.startedAt)} / 長さ: ${dur(c.durationSec)}`,
          "",
          "===== 要約 =====",
          c.summary ?? "",
          "",
          "===== 全文書き起こし =====",
          c.mergedText ?? "",
        ]
          .filter(Boolean)
          .join("\n");

        return (
          <div
            key={c.id}
            className="bg-white border border-brand-border rounded-card shadow-soft overflow-hidden"
          >
            <div className="flex items-center gap-3 p-4 flex-wrap">
              <span className="text-xs text-brand-sub whitespace-nowrap">{fmt(c.startedAt)}</span>
              <span className="text-xs text-brand-sub whitespace-nowrap">{dur(c.durationSec)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${st.cls}`}>
                {st.label}
              </span>
              <span className="flex-1 min-w-[12rem] font-bold text-brand-green text-sm truncate">
                {c.title ?? "（書き起こしなし）"}
              </span>
              {hasText && (
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="text-xs px-3 py-1 rounded-full font-bold border border-brand-border bg-brand-soft text-brand-green hover:bg-brand-leaf/25 transition whitespace-nowrap"
                >
                  {open ? "閉じる" : "書き起こしを見る"}
                </button>
              )}
              {/* 自分の通話の音声だけ落とせる（API側でも所有者を検証している） */}
              <a
                href={`/api/download/${c.sessionId}?track=mixed`}
                className="text-xs px-3 py-1 rounded-full font-bold border border-brand-border bg-brand-soft text-brand-green hover:bg-brand-leaf/25 transition whitespace-nowrap"
              >
                ⤓ 音声DL
              </a>
            </div>

            {open && hasText && (
              <div className="border-t border-brand-border p-4 space-y-4 bg-brand-bg/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <CopyButton text={whole} label="全体をコピー" />
                  {c.summary && <CopyButton text={c.summary} label="要約をコピー" />}
                  {c.mergedText && <CopyButton text={c.mergedText} label="全文をコピー" />}
                </div>
                {c.summary && (
                  <div>
                    <h3 className="text-xs font-bold text-brand-green mb-1.5">要約</h3>
                    <pre className="whitespace-pre-wrap text-sm text-brand-ink leading-relaxed font-sans bg-white border border-brand-border rounded-lg p-4">
                      {c.summary}
                    </pre>
                  </div>
                )}
                {c.mergedText && (
                  <div>
                    <h3 className="text-xs font-bold text-brand-green mb-1.5">全文書き起こし</h3>
                    <pre className="whitespace-pre-wrap text-sm text-brand-ink leading-relaxed font-sans bg-white border border-brand-border rounded-lg p-4 max-h-96 overflow-y-auto">
                      {c.mergedText}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
