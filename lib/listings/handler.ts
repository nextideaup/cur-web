// Per-module "list for sale" route factory. Each module's [id]/list/route.ts
// re-exports POST + GET from here, mirroring the valuation/specs handler
// pattern. POST creates a DRAFT listing on the chosen channel; GET returns the
// listings already recorded for the item.

import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { query, queryOne } from "@/lib/db";
import type { CollectionConfig } from "@/lib/collections/types";
import { getChannel } from "@/lib/listings";
import { buildListingInput, type RawListItem } from "@/lib/listings/mappers";
import { decryptToken, encryptToken } from "@/lib/listings/crypto";
import { refreshAccessToken } from "@/lib/listings/ebay-oauth";
import { ListingConfigError, type ChannelMeta } from "@/lib/listings/types";

function appBaseUrl(): string {
  return process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`;
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
      const channel = getChannel(body.channel ?? "");
      if (!channel) {
        return NextResponse.json({ error: "channel must be 'reverb' or 'ebay'" }, { status: 400 });
      }

      const item = await queryOne<RawListItem & { purchase_price?: number | null }>(
        `SELECT * FROM ${c.table} WHERE id = $1 AND user_id = $2`,
        [id, session.user.id],
      );
      if (!item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }

      // Credential for this channel.
      const cred = await queryOne<{
        token_encrypted: string;
        refresh_token_encrypted: string | null;
        token_expires_at: string | null;
        meta: ChannelMeta;
      }>(
        `SELECT token_encrypted, refresh_token_encrypted, token_expires_at, meta
           FROM marketplace_credentials WHERE user_id = $1 AND channel = $2`,
        [session.user.id, channel.slug],
      );
      if (!cred) {
        return NextResponse.json(
          { error: `Connect your ${channel.label} account first (Marketplace settings).`, code: "not_connected" },
          { status: 400 },
        );
      }
      let token: string;
      try {
        token = decryptToken(cred.token_encrypted);
      } catch {
        return NextResponse.json(
          { error: `Stored ${channel.label} token could not be read. Re-connect the account.`, code: "bad_credential" },
          { status: 400 },
        );
      }
      const meta = (cred.meta ?? {}) as ChannelMeta;

      // eBay OAuth: the access token is short-lived (~2h). When it's expired (or
      // within 60s of it), mint a fresh one from the stored refresh token and
      // persist it. Paste-token credentials have no refresh token and are used
      // as-is. A failed refresh means the seller must re-connect.
      if (channel.slug === "ebay" && cred.refresh_token_encrypted) {
        const expiresAt = cred.token_expires_at ? new Date(cred.token_expires_at).getTime() : 0;
        if (Date.now() > expiresAt - 60_000) {
          try {
            const refreshed = await refreshAccessToken(decryptToken(cred.refresh_token_encrypted));
            token = refreshed.access_token;
            await query(
              `UPDATE marketplace_credentials
                  SET token_encrypted = $1, token_expires_at = $2, updated_at = NOW()
                WHERE user_id = $3 AND channel = 'ebay'`,
              [encryptToken(token), new Date(Date.now() + refreshed.expires_in * 1000), session.user.id],
            );
          } catch (e) {
            console.error(`[listing] eBay token refresh failed for user=${session.user.id}:`, e);
            return NextResponse.json(
              { error: "Your eBay connection expired. Reconnect eBay in Marketplace settings.", code: "reauth" },
              { status: 400 },
            );
          }
        }
      }

      // Price: prefer latest AI, then latest user valuation, then purchase price.
      const latest = await queryOne<{ price: string | number }>(
        `SELECT price FROM ${c.valuationsTable}
          WHERE ${c.valuationFkColumn} = $1
          ORDER BY (valuation_type = 'ai') DESC, created_at DESC
          LIMIT 1`,
        [id],
      );
      const price =
        latest?.price != null ? Number(latest.price)
        : item.purchase_price != null ? Number(item.purchase_price)
        : null;

      // Photos → absolute, publicly fetchable URLs. DB path is "/uploads/<f>";
      // the serve route lives at /api/uploads/<f> and 302s to a presigned URL.
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

      const input = buildListingInput(c.moduleSlug, item, {
        price,
        photoUrls,
        currency: meta.currency || "USD",
      });

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

  return { POST, GET };
}
