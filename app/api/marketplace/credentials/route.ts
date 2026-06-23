// Per-user marketplace credentials (migration 020). Stores an encrypted token
// per channel plus non-secret config in `meta`. The token is never returned —
// GET reports only connection status + meta so the UI can show what's wired up.

import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { encryptToken, encryptionAvailable } from "@/lib/listings/crypto";
import { CHANNEL_SLUGS } from "@/lib/listings";
import type { ChannelMeta, ListingChannelSlug } from "@/lib/listings/types";

// Whitelist the non-secret config we persist into meta, so a caller can't stash
// arbitrary (or sensitive) data on the row.
function sanitizeMeta(input: unknown): ChannelMeta {
  const m = (input ?? {}) as Record<string, unknown>;
  const out: ChannelMeta = {};
  if (typeof m.sandbox === "boolean") out.sandbox = m.sandbox;
  for (const k of ["marketplaceId", "merchantLocationKey", "fulfillmentPolicyId", "paymentPolicyId", "returnPolicyId", "categoryId", "currency"] as const) {
    if (typeof m[k] === "string" && (m[k] as string).trim()) out[k] = (m[k] as string).trim();
  }
  return out;
}

export async function GET(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await query<{ channel: ListingChannelSlug; label: string | null; meta: ChannelMeta; updated_at: string }>(
    `SELECT channel, label, meta, updated_at FROM marketplace_credentials WHERE user_id = $1`,
    [session.user.id],
  );
  const byChannel = new Map(rows.map((r) => [r.channel, r]));
  const channels = CHANNEL_SLUGS.map((slug) => {
    const r = byChannel.get(slug);
    return {
      channel: slug,
      connected: !!r,
      label: r?.label ?? null,
      meta: r?.meta ?? {},
      updated_at: r?.updated_at ?? null,
    };
  });
  return NextResponse.json({ encryption_available: encryptionAvailable(), channels });
}

export async function POST(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!encryptionAvailable()) {
    return NextResponse.json(
      { error: "Credential encryption is not configured on the server (set MARKETPLACE_ENC_KEY or NEXTAUTH_SECRET)." },
      { status: 503 },
    );
  }

  let body: { channel?: string; token?: string; label?: string; meta?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.channel !== "reverb" && body.channel !== "ebay") {
    return NextResponse.json({ error: "channel must be 'reverb' or 'ebay'" }, { status: 400 });
  }
  if (!body.token || typeof body.token !== "string" || !body.token.trim()) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const encrypted = encryptToken(body.token.trim());
  const meta = sanitizeMeta(body.meta);
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;

  await query(
    `INSERT INTO marketplace_credentials (user_id, channel, token_encrypted, label, meta, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     ON CONFLICT (user_id, channel) DO UPDATE SET
       token_encrypted = EXCLUDED.token_encrypted,
       label = EXCLUDED.label,
       meta = EXCLUDED.meta,
       updated_at = NOW()`,
    [session.user.id, body.channel, encrypted, label, JSON.stringify(meta)],
  );

  return NextResponse.json({ ok: true, channel: body.channel, meta });
}

export async function DELETE(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channel = new URL(request.url).searchParams.get("channel");
  if (channel !== "reverb" && channel !== "ebay") {
    return NextResponse.json({ error: "channel must be 'reverb' or 'ebay'" }, { status: 400 });
  }
  await query(`DELETE FROM marketplace_credentials WHERE user_id = $1 AND channel = $2`, [session.user.id, channel]);
  return NextResponse.json({ ok: true });
}
