import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/recordings";

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

    // Auto-register operator role if missing (admin promotion is SQL-only).
    const { data: existing } = await supabase
      .from("user_roles")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (!existing) {
      await supabase.from("user_roles").insert({
        email,
        display_name: user?.user_metadata?.full_name ?? null,
        role: "operator",
      });
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
