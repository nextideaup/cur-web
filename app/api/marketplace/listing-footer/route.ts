// GET/PUT the seller's DEFAULT listing footer (users.listing_footer_default).
// Per-listing overrides live on the item (listing_footer) and save via the item
// PATCH; this is only the account-wide default.

import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { query, queryOne } from "@/lib/db";
import { DEFAULT_LISTING_FOOTER } from "@/lib/listings/footer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await queryOne<{ listing_footer_default: string | null }>(
    `SELECT listing_footer_default FROM users WHERE id = $1`,
    [session.user.id],
  );
  return NextResponse.json({
    footer: row?.listing_footer_default ?? null, // null = using the built-in
    default: DEFAULT_LISTING_FOOTER,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { footer?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  // Empty/blank clears the override (falls back to the built-in default).
  const footer = typeof body.footer === "string" && body.footer.trim() ? body.footer.trim() : null;

  await query(`UPDATE users SET listing_footer_default = $1 WHERE id = $2`, [footer, session.user.id]);
  return NextResponse.json({ ok: true, footer });
}
