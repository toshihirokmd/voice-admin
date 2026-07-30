"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * status=processing の行がある間だけ、一定間隔で router.refresh() して
 * サーバーコンポーネントを再取得する。完了/失敗になり active=false になると止まる。
 * （アップロードの書き起こしは finalize がバックグラウンドで進むため、画面側は
 *   ポーリングで「処理中」→「完了」を自動反映する。）
 */
export function AutoRefresh({
  active,
  intervalMs = 5000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}
