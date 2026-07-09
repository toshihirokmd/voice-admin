import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * service_role キーで Supabase に接続するサーバー専用クライアント。
 * RLS をバイパスするので、必ず server action / route handler の中でだけ使うこと
 * （ブラウザに渡さない）。アップロード書き起こしの Storage 保存・recordings /
 * transcripts への書き込みに使う。
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL が未設定です"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
