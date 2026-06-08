"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: "sakuraforest.co.jp" },
      },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 bg-white border border-brand-border rounded-card shadow-soft p-8 text-center">
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-soft text-base">
          🔑
        </span>
        <h1 className="text-2xl font-extrabold text-brand-green">ログイン</h1>
      </div>
      <p className="text-sm text-brand-sub mb-6">
        @sakuraforest.co.jp のGoogleアカウントでログインしてください。
      </p>
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="w-full py-2.5 px-4 bg-brand-green text-white rounded-xl font-bold hover:bg-brand-dark transition disabled:opacity-50"
      >
        {busy ? "リダイレクト中..." : "Googleでログイン"}
      </button>
      {error && (
        <p className="mt-4 text-sm text-brand-sakura" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
