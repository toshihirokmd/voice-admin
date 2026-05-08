import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import {
  fetchFilteredRecordings,
  parseRecordingsFilterFromSearchParams,
} from "@/lib/recordings/queries";
import { buildRecordingsCsv, csvFilename } from "@/lib/recordings/csv";

export const dynamic = "force-dynamic";

const MAX_ROWS = 10_000;

export async function GET(req: Request) {
  await requireAdmin();
  const supabase = createClient();
  const url = new URL(req.url);
  const filter = parseRecordingsFilterFromSearchParams(url.searchParams);

  const { rows, proposalsBySession, linkedOrdersBySession, displayNamesByEmail } =
    await fetchFilteredRecordings(supabase, filter, { page: 1, pageSize: MAX_ROWS });

  const csvBody = buildRecordingsCsv(
    rows.map((r) => ({
      recording: r,
      proposalKeys: Array.from(proposalsBySession.get(r.session_id) ?? []),
      linkedOrders: linkedOrdersBySession.get(r.session_id),
      displayName: operatorDisplayName(r.operator_email, displayNamesByEmail),
    }))
  );

  // BOM (﻿) keeps Excel from misreading UTF-8 as Shift_JIS.
  const body = "﻿" + csvBody;
  const filename = csvFilename();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

function operatorDisplayName(
  email: string | null,
  byEmail: Map<string, string | null>
): string {
  if (!email) return "未設定";
  const name = byEmail.get(email);
  if (name && name.trim()) return name;
  return email.split("@")[0];
}
