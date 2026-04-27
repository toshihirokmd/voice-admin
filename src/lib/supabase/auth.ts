import { redirect } from "next/navigation";
import { createClient } from "./server";

export type UserRole = "admin" | "operator";

export type SignedInUser = {
  email: string;
  displayName: string | null;
  role: UserRole | null;
};

export async function getCurrentUser(): Promise<SignedInUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role,display_name")
    .eq("email", user.email)
    .maybeSingle();

  return {
    email: user.email,
    displayName: roleRow?.display_name ?? null,
    role: (roleRow?.role as UserRole | undefined) ?? null,
  };
}

export async function requireUser(): Promise<SignedInUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SignedInUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/forbidden");
  return user;
}
