"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export type ActionResult =
  | { ok: true; message: string; ts: number }
  | { ok: false; message: string; ts: number }
  | null;

type Variant = "primary" | "secondary" | "danger" | "success";

const baseClasses: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-200 text-gray-700 hover:bg-gray-300",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-green-600 text-white hover:bg-green-700",
};

const pendingClasses: Record<Variant, string> = {
  primary: "bg-blue-400 text-white",
  secondary: "bg-gray-300 text-gray-700",
  danger: "bg-red-400 text-white",
  success: "bg-green-400 text-white",
};

export type StatefulSaveButtonProps = {
  /**
   * Action result returned from useFormState. Used to flip the button into
   * the success / error state when state.ts changes.
   */
  result: ActionResult;
  label?: string;
  savingLabel?: string;
  savedLabel?: string;
  errorLabel?: string;
  variant?: Variant;
  size?: "sm" | "md";
  /** Optional extra Tailwind classes appended last. */
  className?: string;
};

/**
 * A submit button that visualises four states: idle, pending (spinner +
 * "saving"), success (green check, auto-reverts), error (red retry hint).
 *
 * Usage:
 *   const [state, action] = useFormState(myAction, null);
 *   <form action={action}>
 *     ...inputs...
 *     <StatefulSaveButton result={state} />
 *   </form>
 */
export function StatefulSaveButton({
  result,
  label = "保存",
  savingLabel = "保存中…",
  savedLabel = "✓ 保存しました",
  errorLabel = "✕ 保存失敗",
  variant = "primary",
  size = "md",
  className = "",
}: StatefulSaveButtonProps) {
  const { pending } = useFormStatus();
  const [showSaved, setShowSaved] = useState(false);
  const [showError, setShowError] = useState(false);

  const successAt = result?.ok === true ? result.ts : null;
  const errorAt = result?.ok === false ? result.ts : null;

  useEffect(() => {
    if (!successAt) return;
    setShowSaved(true);
    setShowError(false);
    const timer = setTimeout(() => setShowSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [successAt]);

  useEffect(() => {
    if (!errorAt) return;
    setShowError(true);
    setShowSaved(false);
    const timer = setTimeout(() => setShowError(false), 4000);
    return () => clearTimeout(timer);
  }, [errorAt]);

  const sizeClass = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm";
  const commonClass = `${sizeClass} rounded transition-colors duration-200 inline-flex items-center gap-2 ${className}`;

  if (pending) {
    return (
      <button type="submit" disabled className={`${commonClass} ${pendingClasses[variant]}`}>
        <span
          className="inline-block h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin"
          aria-hidden
        />
        {savingLabel}
      </button>
    );
  }

  if (showSaved) {
    return (
      <button type="submit" className={`${commonClass} bg-green-600 text-white`}>
        {savedLabel}
      </button>
    );
  }

  if (showError) {
    return (
      <button type="submit" className={`${commonClass} bg-red-600 text-white`}>
        {errorLabel}
      </button>
    );
  }

  return (
    <button type="submit" className={`${commonClass} ${baseClasses[variant]}`}>
      {label}
    </button>
  );
}
