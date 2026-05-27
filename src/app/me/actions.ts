"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/forms/stateful-save-button";

export async function updateMyDisplayName(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireUser();
    const displayName = String(formData.get("display_name") ?? "").trim();
    if (!displayName) {
      return { ok: false, message: "表示名を入力してください", ts: Date.now() };
    }
    if (displayName.length > 80) {
      return { ok: false, message: "80文字以内で入力してください", ts: Date.now() };
    }
    const supabase = createClient();
    const { error } = await supabase.rpc("rpc_upsert_self_user_role", {
      p_display_name: displayName,
    });
    if (error) {
      return { ok: false, message: error.message, ts: Date.now() };
    }
    revalidatePath("/me");
    revalidatePath("/", "layout");
    return { ok: true, message: "保存しました", ts: Date.now() };
  } catch (exc) {
    return {
      ok: false,
      message: exc instanceof Error ? exc.message : String(exc),
      ts: Date.now(),
    };
  }
}
