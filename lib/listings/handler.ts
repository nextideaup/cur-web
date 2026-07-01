// Per-module "list for sale" route factory. Each module's [id]/list/route.ts
// re-exports POST + GET from here, mirroring the valuation/specs handler
// pattern. POST creates a DRAFT listing on the chosen channel; GET returns the
// listings already recorded for the item.

import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { query, queryOne } from "@/lib/db";
import type { CollectionConfig } from "@/lib/collections/types";
import { getChannel } from "@/lib/listings";
import { publishEbayOffer } from "@/lib/listings/ebay";
import { buildListingInput, type RawListItem } from "@/lib/listings/mappers";
import { resolveFooter } from "@/lib/listings/footer";
import { decryptToken } from "@/lib/listings/crypto";
import { resolveEbayAccessToken } from "@/lib/listings/ebay-account";
import { ListingConfigError, type ChannelMeta, type ListingChannel, type ListingInput } from "@/lib/listings/types";

function appBaseUrl(): string {
  return process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`;
}

type Assembled =
  | { ok: true; channel: ListingChannel; input: ListingInput; token: string; meta: ChannelMeta }
  | { ok: false; response: NextResponse };

// Gather everything needed to (re)create a draft for one item on one channel:
// resolve credentials/token, price, photos, footer, and build the ListingInput.
// Shared by the draft POST and the publish re-sync so both always use the
// latest item data (weight, intro, footer, price, specs).
async function assembleListing(c: CollectionConfig, userId: string, id: string, channelSlug: string): Promise<Assembled> {
  const channel = getChannel(channelSlug);
  if (!channel) {
    return { ok: false, response: NextResponse.json({ error: "channel must be 'reverb' or 'ebay'" }, { status: 400 }) };
  }

  const item = await queryOne<RawListItem & { purchase_price?: number | null }>(
    `SELECT * FROM ${c.table} WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (!item) return { ok: false, response: NextResponse.json({ error: "Item not found" }, { status: 404 }) };

  const cred = await queryOne<{ token_encrypted: string; meta: ChannelMeta }>(
    `SELECT token_encrypted, meta FROM marketplace_credentials WHERE user_id = $1 AND channel = $2`,
    [userId, channel.slug],
  );
  if (!cred) {
    return { ok: false, response: NextResponse.json({ error: `Connect your ${channel.label} account first (Marketplace settings).`, code: "not_connected" }, { status: 400 }) };
  }
  const meta = (cred.meta ?? {}) as ChannelMeta;

  let token: string;
  if (channel.slug === "ebay") {
    const resolved = await resolveEbayAccessToken(userId);
    if (resolved.error || !resolved.token) {
      return { ok: false, response: NextResponse.json({ error: "Your eBay connection expired. Reconnect eBay in Marketplace settings.", code: "reauth" }, { status: 400 }) };
    }
    token = resolved.token;
  } else {
    try {
      token = decryptToken(cred.token_encrypted);
    } catch {
      return { ok: false, response: NextResponse.json({ error: `Stored ${channel.label} token could not be read. Re-connect the account.`, code: "bad_credential" }, { status: 400 }) };
    }
  }

  const latest = await queryOne<{ price: string | number }>(
    `SELECT price FROM ${c.valuationsTable}
      WHERE ${c.valuationFkColumn} = $1
      ORDER BY (valuation_type = 'ai') DESC, created_at DESC LIMIT 1`,
    [id],
  );
  const price =
    latest?.price != null ? Number(latest.price)
    : item.purchase_price != null ? Number(item.purchase_price)
    : null;

  const imgs = await query<{ path: string }>(
    `SELECT path FROM ${c.imagesTable} WHERE ${c.imageFkColumn} = $1
      ORDER BY sort_order ASC, is_primary DESC, created_at ASC`,
    [id],
  );
  const base = appBaseUrl();
  const photoUrls = imgs
    .map((r) => r.path)
    .filter((p) => typeof p === "string" && p.startsWith("/uploads/"))
    .map((p) => `${base}/api${p}`);

  const userDefault = await queryOne<{ listing_footer_default: string | null }>(
    `SELECT listing_footer_default FROM users WHERE id = $1`,
    [userId],
  );
  const footer = resolveFooter((item as { listing_footer?: string | null }).listing_footer, userDefault?.listing_footer_default);

  const input = buildListingInput(c.moduleSlug, item, { price, photoUrls, currency: meta.currency || "USD", footer });
  return { ok: true, channel, input, token, meta };
}

export function makeListingHandler(c: CollectionConfig) {
  async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
      const session = await getApiSession(request);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { id } = await params;

      let body: { channel?: string };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      const asm = await assembleListing(c, session.user.id, id, body.channel ?? "");
      if (!asm.ok) return asm.response;
      const { channel, input, token, meta } = asm;

      try {
        const result = await channel.createDraft(input, token, meta);
        const row = await queryOne(
          `INSERT INTO marketplace_listings
             (user_id, channel, module, item_id, external_id, external_url, state, payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            session.user.id,
            channel.slug,
            c.moduleSlug,
            id,
            result.externalId,
            result.externalUrl,
            result.state,
            JSON.stringify(result.payload),
          ],
        );
        return NextResponse.json({ listing: row, ...result });
      } catch (err) {
        if (err instanceof ListingConfigError) {
          // User-actionable misconfiguration — not an error worth recording.
          return NextResponse.json({ error: err.message, code: "config" }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : String(err);
        // Record the failed attempt so the user sees what went wrong.
        await query(
          `INSERT INTO marketplace_listings
             (user_id, channel, module, item_id, state, error)
           VALUES ($1, $2, $3, $4, 'error', $5)`,
          [session.user.id, channel.slug, c.moduleSlug, id, message],
        );
        console.error(`[listing] ${channel.slug} draft failed for ${c.label} id=${id}:`, message);
        return NextResponse.json({ error: `${channel.label}: ${message}` }, { status: 502 });
      }
    } catch (error) {
      console.error(`POST /api/${c.label}/[id]/list error:`, error);
      return NextResponse.json({ error: "Failed to create listing" }, { status: 500 });
    }
  }

  async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
      const session = await getApiSession(request);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { id } = await params;
      const rows = await query(
        `SELECT id, channel, external_id, external_url, state, error, created_at
           FROM marketplace_listings
          WHERE user_id = $1 AND module = $2 AND item_id = $3
          ORDER BY created_at DESC`,
        [session.user.id, c.moduleSlug, id],
      );
      return NextResponse.json(rows);
    } catch (error) {
      console.error(`GET /api/${c.label}/[id]/list error:`, error);
      return NextResponse.json({ error: "Failed to fetch listings" }, { status: 500 });
    }
  }

  // Remove a Vault 1 listing record. This deletes only our tracking row — it
  // does NOT end/delete the listing on the marketplace (the seller manages the
  // live listing there). Used to clear a stale row after deleting on Reverb/eBay
  // or to dismiss a recorded error.
  async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
      const session = await getApiSession(request);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { id } = await params;
      const listingId = new URL(request.url).searchParams.get("listingId");
      if (!listingId) {
        return NextResponse.json({ error: "listingId is required" }, { status: 400 });
      }
      const deleted = await query<{ id: string }>(
        `DELETE FROM marketplace_listings
           WHERE id = $1 AND user_id = $2 AND module = $3 AND item_id = $4
           RETURNING id`,
        [listingId, session.user.id, c.moduleSlug, id],
      );
      if (deleted.length === 0) {
        return NextResponse.json({ error: "Listing record not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error(`DELETE /api/${c.label}/[id]/list error:`, error);
      return NextResponse.json({ error: "Failed to remove listing record" }, { status: 500 });
    }
  }

  return { POST, GET, DELETE };
}

// Publish an eBay draft (unpublished offer) → a LIVE listing. Explicit,
// user-initiated. Body: { listingId } (a marketplace_listings row id for an
// eBay draft). Updates the row to state='published' with the live listing URL.
export function makePublishHandler(c: CollectionConfig) {
  return async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
      const session = await getApiSession(request);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { id } = await params;
      let body: { listingId?: string };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
      if (!body.listingId) {
        return NextResponse.json({ error: "listingId is required" }, { status: 400 });
      }

      const row = await queryOne<{ id: string; external_id: string | null; state: string; external_url: string | null }>(
        `SELECT id, external_id, state, external_url FROM marketplace_listings
          WHERE id = $1 AND user_id = $2 AND module = $3 AND item_id = $4 AND channel = 'ebay'`,
        [body.listingId, session.user.id, c.moduleSlug, id],
      );
      if (!row) return NextResponse.json({ error: "eBay draft not found" }, { status: 404 });
      if (row.state === "published") {
        return NextResponse.json({ state: "published", external_url: row.external_url });
      }

      // Re-sync the draft with the latest item data FIRST (weight, intro, footer,
      // price, specs), so Publish always reflects what's on the item now — no
      // need to manually re-draft after an edit. Then publish that fresh offer.
      const asm = await assembleListing(c, session.user.id, id, "ebay");
      if (!asm.ok) return asm.response;

      const recordError = async (message: string) => {
        await query(
          `UPDATE marketplace_listings SET error = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
          [message, row.id, session.user.id],
        );
      };

      let offerId: string | null;
      try {
        const refreshed = await asm.channel.createDraft(asm.input, asm.token, asm.meta);
        offerId = refreshed.externalId ?? row.external_id;
      } catch (err) {
        if (err instanceof ListingConfigError) {
          return NextResponse.json({ error: err.message, code: "config" }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : String(err);
        await recordError(message);
        return NextResponse.json({ error: `eBay: ${message}` }, { status: 502 });
      }
      if (!offerId) {
        return NextResponse.json({ error: "Could not resolve the eBay offer to publish. Re-draft and try again." }, { status: 400 });
      }

      try {
        const { url } = await publishEbayOffer(offerId, asm.token, asm.meta);
        await query(
          `UPDATE marketplace_listings SET state = 'published', external_id = $1, external_url = $2, error = NULL, updated_at = NOW()
            WHERE id = $3 AND user_id = $4`,
          [offerId, url, row.id, session.user.id],
        );
        return NextResponse.json({ state: "published", external_url: url });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Record the reason on the row so it shows in the Sell section (publish
        // is where eBay enforces required item specifics — the message names them).
        await recordError(message);
        console.error(`[listing] eBay publish failed for ${c.label} id=${id}:`, message);
        return NextResponse.json({ error: `eBay: ${message}` }, { status: 502 });
      }
    } catch (error) {
      console.error(`POST /api/${c.label}/[id]/list/publish error:`, error);
      return NextResponse.json({ error: "Failed to publish listing" }, { status: 500 });
    }
  };
}
