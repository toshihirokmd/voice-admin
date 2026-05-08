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
  // gviz endpoint takes a sheet *name* directly, which is more durable than
  // a numeric gid — the SKU↔group sheet has a stable "data" tab next to the
  // SQL helper sheet, and we only ever want the data tab.
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  let csvText: string;
  try {
    const upstream = await fetch(csvUrl, {
      // Next.js will obey revalidate for fetch-level caching too.
      next: { revalidate },
      // Google sometimes 302-redirects through a login page when the sheet
      // isn't shared widely — manual redirect lets us spot that case.
      redirect: "follow",
      headers: { Accept: "text/csv" },
    });
    if (!upstream.ok) {
      return errorJson(
        `Sheet fetch failed: ${upstream.status} ${upstream.statusText}`,
        502
      );
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      // Google returns an HTML login page when the sheet isn't readable.
      return errorJson(
        "Sheet is not publicly readable. Share with 'Anyone with the link → viewer' or wire a service account.",
        502
      );
    }
    csvText = await upstream.text();
  } catch (err) {
    return errorJson(
      `Sheet fetch raised: ${err instanceof Error ? err.message : String(err)}`,
      502
    );
  }

  const items = parseCsv(csvText);
  return cors(
    NextResponse.json({
      updated_at: new Date().toISOString(),
      sheet_id: sheetId,
      sheet_name: sheetName,
      count: items.length,
      items,
    })
  );
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
