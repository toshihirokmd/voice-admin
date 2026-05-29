/**
 * Filtered recordings query layer.
 *
 * Hosts the multi-step filter pipeline that the /recordings list page used to
 * keep inline. Centralized here so the CSV export route can reuse the same
 * logic with a different page size.
 *
 * Filter pipeline (each step narrows the candidate set, short-circuits when
 * the current step yields zero matches):
 *   1. proposals (successKeys × AND/OR)        → session_ids
 *   2. transcripts (products × AND/OR)         → recording_ids
 *   3. recording_orders (productGroups × AND/OR + orderNumber ILIKE)
 *                                               → session_ids
 *   4. recordings: operator ILIKE, status IN, started_at range
 *   5. post-fetch: title+summary substring match (free text query)
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RecordingsFilter = {
  query?: string;
  operator?: string;
  startDate?: string; // YYYY-MM-DD (JST midnight)
  endDate?: string; // YYYY-MM-DD (JST end-of-day)
  statuses?: string[];
  orderNumber?: string; // partial match
  successKeys?: string[];
  successMatch?: "and" | "or";
  products?: string[];
  productMatch?: "and" | "or";
  productGroups?: string[];
  productGroupMatch?: "and" | "or";
};

export type RecordingTranscript = {
  title: string | null;
  summary: string | null;
  merged_text: string | null;
  products: string[] | null;
};

export type Recording = {
  id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  operator_email: string | null;
  status: string;
  call_type: string | null;
  transcripts: RecordingTranscript[];
};

export type LinkedOrderSummary = {
  orderNumbers: string[];
  productGroups: string[];
};

export type FetchRecordingsResult = {
  rows: Recording[];
  count: number;
  proposalsBySession: Map<string, Set<string>>;
  linkedOrdersBySession: Map<string, LinkedOrderSummary>;
  displayNamesByEmail: Map<string, string | null>;
};

export async function fetchFilteredRecordings(
  supabase: SupabaseClient,
  filter: RecordingsFilter,
  opts: { page: number; pageSize: number }
): Promise<FetchRecordingsResult> {
  const empty: FetchRecordingsResult = {
    rows: [],
    count: 0,
    proposalsBySession: new Map(),
    linkedOrdersBySession: new Map(),
    displayNamesByEmail: new Map(),
  };

  // Step 1: proposals filter → session_ids
  let allowedSessionIds: Set<string> | null = null;
  if (filter.successKeys && filter.successKeys.length > 0) {
    let pq = supabase.from("proposals").select("session_id");
    if (filter.successMatch === "or") {
      const orClause = filter.successKeys
        .map((key) => `items->>${key}.eq.1`)
        .join(",");
      pq = pq.or(orClause);
    } else {
      for (const key of filter.successKeys) {
        pq = pq.eq(`items->>${key}`, "1");
      }
    }
    const { data } = await pq;
    allowedSessionIds = new Set((data ?? []).map((r: { session_id: string }) => r.session_id));
    if (allowedSessionIds.size === 0) return empty;
  }

  // Step 2: transcripts → recording_ids (products filter)
  let allowedRecordingIds: Set<string> | null = null;
  if (filter.products && filter.products.length > 0) {
    let tq = supabase.from("transcripts").select("recording_id");
    if (filter.productMatch === "or") {
      tq = tq.overlaps("products", filter.products);
    } else {
      tq = tq.contains("products", filter.products);
    }
    const { data } = await tq;
    allowedRecordingIds = new Set(
      (data ?? []).map((r: { recording_id: string }) => r.recording_id)
    );
    if (allowedRecordingIds.size === 0) return empty;
  }

  // Step 3: recording_orders → session_ids (product_groups + order_number)
  const groupFilterActive =
    filter.productGroups && filter.productGroups.length > 0;
  const orderNumActive = Boolean(filter.orderNumber);
  if (groupFilterActive || orderNumActive) {
    let oq = supabase.from("recording_orders").select("session_id,product_groups");
    if (groupFilterActive) {
      if (filter.productGroupMatch === "or") {
        oq = oq.overlaps("product_groups", filter.productGroups!);
      } else {
        oq = oq.contains("product_groups", filter.productGroups!);
      }
    }
    if (orderNumActive) {
      oq = oq.ilike("order_number", `%${filter.orderNumber}%`);
    }
    const { data } = await oq;
    const matched = new Set(
      (data ?? []).map((r: { session_id: string }) => r.session_id)
    );
    allowedSessionIds = allowedSessionIds
      ? new Set([...allowedSessionIds].filter((s) => matched.has(s)))
      : matched;
    if (allowedSessionIds.size === 0) return empty;
  }

  // Step 4: main recordings query with remaining filters
  const from = (opts.page - 1) * opts.pageSize;
  const to = from + opts.pageSize - 1;
  let query = supabase
    .from("recordings")
    .select(
      "id,session_id,started_at,ended_at,duration_sec,operator_email,status,call_type,transcripts(title,summary,merged_text,products)",
      { count: "exact" }
    )
    .order("started_at", { ascending: false })
    .range(from, to);

  if (filter.operator) {
    query = query.ilike("operator_email", `%${filter.operator}%`);
  }
  if (filter.statuses && filter.statuses.length > 0) {
    query = query.in("status", filter.statuses);
  }
  if (filter.startDate) {
    query = query.gte("started_at", `${filter.startDate}T00:00:00+09:00`);
  }
  if (filter.endDate) {
    query = query.lte("started_at", `${filter.endDate}T23:59:59+09:00`);
  }
  if (allowedSessionIds) {
    query = query.in("session_id", Array.from(allowedSessionIds));
  }
  if (allowedRecordingIds) {
    query = query.in("id", Array.from(allowedRecordingIds));
  }

  const { data: recordings, count } = await query;
  let rows = (recordings ?? []) as Recording[];

  // Step 5: post-fetch free text filter (title + summary).
  // Done in JS because Supabase JS client can't easily build OR across an
  // embedded resource (transcripts.title OR transcripts.summary).
  if (filter.query) {
    const needle = filter.query.toLowerCase();
    rows = rows.filter((r) => {
      const t = r.transcripts?.[0];
      const title = (t?.title ?? "").toLowerCase();
      const summary = (t?.summary ?? "").toLowerCase();
      return title.includes(needle) || summary.includes(needle);
    });
  }

  // Sidecar lookups for the visible rows.
  const sessionIds = rows.map((r) => r.session_id);

  const proposalsBySession = new Map<string, Set<string>>();
  if (sessionIds.length > 0) {
    const { data: proposalRows } = await supabase
      .from("proposals")
      .select("session_id,items")
      .in("session_id", sessionIds);
    for (const p of (proposalRows ?? []) as { session_id: string; items: Record<string, unknown> }[]) {
      const set = proposalsBySession.get(p.session_id) ?? new Set<string>();
      for (const [k, v] of Object.entries(p.items ?? {})) {
        if (v === "1") set.add(k);
      }
      proposalsBySession.set(p.session_id, set);
    }
  }

  const linkedOrdersBySession = new Map<string, LinkedOrderSummary>();
  if (sessionIds.length > 0) {
    const { data: linkedRows } = await supabase
      .from("recording_orders")
      .select("session_id,order_number,product_groups")
      .in("session_id", sessionIds);
    for (const row of (linkedRows ?? []) as {
      session_id: string;
      order_number: string | null;
      product_groups: string[] | null;
    }[]) {
      const entry =
        linkedOrdersBySession.get(row.session_id) ??
        ({ orderNumbers: [], productGroups: [] } as LinkedOrderSummary);
      if (row.order_number) entry.orderNumbers.push(row.order_number);
      for (const g of row.product_groups ?? []) {
        if (g && !entry.productGroups.includes(g)) entry.productGroups.push(g);
      }
      linkedOrdersBySession.set(row.session_id, entry);
    }
  }

  const displayNamesByEmail = new Map<string, string | null>();
  const emails = Array.from(
    new Set(rows.map((r) => r.operator_email).filter((e): e is string => Boolean(e)))
  );
  if (emails.length > 0) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("email,display_name")
      .in("email", emails);
    for (const r of (roles ?? []) as { email: string; display_name: string | null }[]) {
      displayNamesByEmail.set(r.email, r.display_name);
    }
  }

  return {
    rows,
    count: count ?? rows.length,
    proposalsBySession,
    linkedOrdersBySession,
    displayNamesByEmail,
  };
}

export function parseRecordingsFilterFromSearchParams(
  sp: URLSearchParams
): RecordingsFilter {
  const arr = (key: string): string[] => sp.getAll(key).filter(Boolean);
  const matchOf = (key: string): "and" | "or" =>
    sp.get(key) === "or" ? "or" : "and";
  return {
    query: sp.get("q") || undefined,
    operator: sp.get("operator") || undefined,
    startDate: sp.get("start_date") || undefined,
    endDate: sp.get("end_date") || undefined,
    statuses: arr("status"),
    orderNumber: sp.get("order_number") || undefined,
    successKeys: arr("success"),
    successMatch: matchOf("match"),
    products: arr("product"),
    productMatch: matchOf("product_match"),
    productGroups: arr("product_group"),
    productGroupMatch: matchOf("product_group_match"),
  };
}

/**
 * Build the master list of product-group names that show up in the data.
 * Used to render the filter UI; sourced from recording_orders.product_groups
 * so we only show groups operators have actually picked.
 */
export async function fetchKnownProductGroups(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("recording_orders")
    .select("product_groups");
  const set = new Set<string>();
  for (const row of (data ?? []) as { product_groups: string[] | null }[]) {
    for (const g of row.product_groups ?? []) {
      if (g) set.add(g);
    }
  }
  return [...set].sort();
}

/**
 * Serialize a filter back into URL search params. Used to build pagination
 * links and the CSV export URL while keeping every active filter intact.
 */
export function buildSearchParams(
  filter: RecordingsFilter,
  extra: Record<string, string | undefined> = {}
): URLSearchParams {
  const sp = new URLSearchParams();
  if (filter.query) sp.set("q", filter.query);
  if (filter.operator) sp.set("operator", filter.operator);
  if (filter.startDate) sp.set("start_date", filter.startDate);
  if (filter.endDate) sp.set("end_date", filter.endDate);
  if (filter.orderNumber) sp.set("order_number", filter.orderNumber);
  for (const s of filter.statuses ?? []) sp.append("status", s);
  for (const k of filter.successKeys ?? []) sp.append("success", k);
  if (filter.successMatch === "or") sp.set("match", "or");
  for (const p of filter.products ?? []) sp.append("product", p);
  if (filter.productMatch === "or") sp.set("product_match", "or");
  for (const g of filter.productGroups ?? []) sp.append("product_group", g);
  if (filter.productGroupMatch === "or") sp.set("product_group_match", "or");
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) sp.delete(k);
    else sp.set(k, v);
  }
  return sp;
}

export function countActiveFilters(f: RecordingsFilter): number {
  let n = 0;
  if (f.query) n++;
  if (f.operator) n++;
  if (f.startDate) n++;
  if (f.endDate) n++;
  if (f.statuses && f.statuses.length > 0) n++;
  if (f.orderNumber) n++;
  if (f.successKeys && f.successKeys.length > 0) n++;
  if (f.products && f.products.length > 0) n++;
  if (f.productGroups && f.productGroups.length > 0) n++;
  return n;
}
