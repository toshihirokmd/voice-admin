import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/me";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    // Domain enforcement: only @sakuraforest.co.jp users may proceed.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email?.toLowerCase() ?? "";
    if (!email.endsWith("@sakuraforest.co.jp")) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=domain_not_allowed`);
    }

    // Auto-register operator role if missing.
    // 直接 INSERT は RLS で reject されるため、SECURITY DEFINER な RPC 経由で upsert。
    const { data: existing } = await supabase
      .from("user_roles")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (!existing) {
      const displayName =
        (user?.user_metadata?.full_name as string | undefined) ??
        (user?.user_metadata?.name as string | undefined) ??
        email.split("@")[0];
      const { error: rpcError } = await supabase.rpc(
        "rpc_upsert_self_user_role",
        { p_display_name: displayName }
      );
      if (rpcError) {
        console.error("[auth/callback] auto-register failed:", rpcError);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
