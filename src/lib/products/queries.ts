import { createClient } from "@/lib/supabase/server";

export type Product = {
  id: string;
  name: string;
  kana: string | null;
  sort_order: number;
  is_active: boolean;
};

/**
 * Fetch products visible to authenticated users — used by recordings page
 * filters and the master admin page alike. Active rows first.
 */
export async function fetchProducts(includeInactive = false): Promise<Product[]> {
  const supabase = createClient();
  let query = supabase
    .from("products")
    .select("id,name,kana,sort_order,is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data as Product[];
}
