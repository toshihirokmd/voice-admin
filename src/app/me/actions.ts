"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/forms/stateful-save-button";
import { generateDailyReport } from "@/lib/me/report-generator";
import { jstTodayYmd } from "@/lib/dashboard/date";

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

/**
 * 「今日のレポートを生成」ボタンの Server Action。
 * 当日の自分の transcripts を Gemini で評価し、daily_reports に upsert する。
 */
export async function generateTodayReport(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const supabase = createClient();
    const todayYmd = jstTodayYmd();

    const report = await generateDailyReport(supabase, user.email, todayYmd);
    if (!report) {
      return {
        ok: false,
        message: "本日の書き起こし済み通話がありません",
        ts: Date.now(),
      };
    }

    const { error } = await supabase
      .from("daily_reports")
      .upsert(
        {
          operator_email: user.email,
          report_date: todayYmd,
          highlights: report.highlights,
          overall_comment: report.overall_comment,
          tokens_in: report.tokens_in,
          tokens_out: report.tokens_out,
          model: report.model,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "operator_email,report_date" }
      );
    if (error) {
      return { ok: false, message: error.message, ts: Date.now() };
    }
    revalidatePath("/me");
    return {
      ok: true,
      message: `${report.source_transcript_count}件を分析しました`,
      ts: Date.now(),
    };
  } catch (exc) {
    return {
      ok: false,
      message: exc instanceof Error ? exc.message : String(exc),
      ts: Date.now(),
    };
  }
}
