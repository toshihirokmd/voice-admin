import { NextResponse } from "next/server";

/**
 * Proxies the "商品グループの一覧をだすSQL" Google Sheet for the Voice
 * Transcription extension.
 *
 * The sheet is auto-updated weekly by the data team. We pull it fresh once a
 * day at build/runtime via Next.js's `revalidate` cache, parse the CSV, and
 * return a JSON snapshot the Chrome extension can store in
 * chrome.storage.local.
 *
 * Setup required (one-time):
 *   1. The sheet must be either:
 *        a) shared "anyone with link → viewer" (CSV export URL works), or
 *        b) shared with a service account whose JSON is loaded via
 *           GOOGLE_SERVICE_ACCOUNT_JSON (TODO if (a) isn't acceptable).
 *   2. Set PRODUCT_GROUPS_SHEET_ID + PRODUCT_GROUPS_SHEET_GID in Vercel env
 *      (defaults below match the current "商品グループの一覧をだすSQL" sheet
 *      and its first data tab; tweak in Vercel dashboard if the gid changes).
 */

const DEFAULT_SHEET_ID = "1n2RCWATHm72djYV1NJqd2pALA54eBoIGGC-TpdqHBXE";
const DEFAULT_SHEET_NAME = "data";

// Re-fetch the upstream sheet at most once a day. The widget caches its own
// copy for 7 days, so the operator-facing freshness window is bounded by the
// shorter of the two — i.e. ~1 day.
export const revalidate = 60 * 60 * 24;

type ProductGroupItem = {
  product_name: string;
  product_group: string;
};

export async function GET(): Promise<NextResponse> {
  const sheetId = process.env.PRODUCT_GROUPS_SHEET_ID ?? DEFAULT_SHEET_ID;
  const sheetName = process.env.PRODUCT_GROUPS_SHEET_NAME ?? DEFAULT_SHEET_NAME;
  // The "group" tab holds the canonical list of valid product groups (col A =
  // index, col B = group name). The extension needs it to classify order names
  // that don't exactly match the SQL-generated "data" tab (campaign-decorated
  // SKU names). Tab name is overridable but defaults to "group".
  const groupTabName = process.env.PRODUCT_GROUPS_GROUP_SHEET_NAME ?? "group";

  const csvUrl = (name: string) =>
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;

  async function fetchTab(name: string): Promise<string> {
    const upstream = await fetch(csvUrl(name), {
      next: { revalidate },
      redirect: "follow",
      headers: { Accept: "text/csv" },
    });
    if (!upstream.ok) {
      throw new Error(`Sheet fetch failed: ${upstream.status} ${upstream.statusText}`);
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      throw new Error(
        "Sheet is not publicly readable. Share with 'Anyone with the link → viewer' or wire a service account."
      );
    }
    return upstream.text();
  }

  let csvText: string;
  let groupCsv = "";
  try {
    csvText = await fetchTab(sheetName);
  } catch (err) {
    return errorJson(err instanceof Error ? err.message : String(err), 502);
  }
  try {
    // The group tab is a nice-to-have fallback vocabulary; if it fails we still
    // return items so exact-match classification keeps working.
    groupCsv = await fetchTab(groupTabName);
  } catch {
    groupCsv = "";
  }

  const items = parseCsv(csvText);
  const groups = parseGroupTab(groupCsv);
  return cors(
    NextResponse.json({
      updated_at: new Date().toISOString(),
      sheet_id: sheetId,
      sheet_name: sheetName,
      count: items.length,
      items,
      groups,
    })
  );
}

/**
 * Parse the "group" tab: two columns (index, group_name). We only need the
 * distinct group names (col B). Skips a header row if present and blanks.
 */
function parseGroupTab(text: string): string[] {
  if (!text) return [];
  const rows = splitCsvRows(text);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const cells of rows) {
    // group name is the last non-empty cell on the row (col B in practice).
    const name = (cells[1] ?? cells[0] ?? "").trim();
    if (!name) continue;
    // Skip an obvious header ("product_group", "group", numeric-only index rows).
    if (/^product[_ ]?group$/i.test(name) || name === "group") continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function OPTIONS(): NextResponse {
  // Preflight for the chrome-extension origin.
  return cors(new NextResponse(null, { status: 204 }));
}

/**
 * Bare-bones CSV parser for a 2-column sheet (product_name, product_group).
 * Handles double-quoted fields with embedded commas and escaped double quotes.
 * Skips the header row and any rows where either column is empty.
 */
function parseCsv(text: string): ProductGroupItem[] {
  const rows = splitCsvRows(text);
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  // We don't strictly require the header to match — we just expect two columns.
  // Keep the column lookup explicit anyway in case the sheet adds more columns.
  const nameIndex = header.findIndex((c) => /product[_ ]?name/i.test(c)) >= 0
    ? header.findIndex((c) => /product[_ ]?name/i.test(c))
    : 0;
  const groupIndex = header.findIndex((c) => /product[_ ]?group/i.test(c)) >= 0
    ? header.findIndex((c) => /product[_ ]?group/i.test(c))
    : 1;
  const items: ProductGroupItem[] = [];
  for (const cells of body) {
    const product_name = cells[nameIndex]?.trim() ?? "";
    const product_group = cells[groupIndex]?.trim() ?? "";
    if (!product_name || !product_group) continue;
    items.push({ product_name, product_group });
  }
  return items;
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      cell = "";
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }
  return rows;
}

function errorJson(message: string, status: number): NextResponse {
  return cors(NextResponse.json({ error: message }, { status }));
}

function cors(response: NextResponse): NextResponse {
  // The Voice Transcription Chrome extension calls this from a content
  // script-spawned chrome-extension://<id> origin. Allow any origin since the
  // payload is non-sensitive (商品マスタは社外秘度低).
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Accept");
  return response;
}
