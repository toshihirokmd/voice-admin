"use client";

import { useState } from "react";

/** 書き起こし・要約をワンクリックでコピーする。押すと2秒だけ「コピーしました」に変わる。 */
export function CopyButton({ text, label = "コピー" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // クリップボードAPIが使えない環境（古い/権限なし）は選択コピーにフォールバック
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs px-3 py-1 rounded-full font-bold border border-brand-border bg-brand-soft text-brand-green hover:bg-brand-leaf/25 transition whitespace-nowrap"
    >
      {copied ? "✓ コピーしました" : `📋 ${label}`}
    </button>
  );
}
