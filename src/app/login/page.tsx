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
    <div className="max-w-md mx-auto mt-12 bg-white rounded-lg shadow p-8">
      <h1 className="text-2xl font-bold mb-2">ログイン</h1>
      <p className="text-sm text-gray-600 mb-6">
        @sakuraforest.co.jp のGoogleアカウントでログインしてください。
      </p>
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        className="w-full py-2.5 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "リダイレクト中..." : "Googleでログイン"}
      </button>
      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
