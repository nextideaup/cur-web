// Reverb channel adapter. Creates a DRAFT listing via a single POST to
// /api/listings with `publish: false` — the user reviews and publishes from
// Reverb. Auth is a personal access token (Bearer).
//
// Docs: https://www.reverb-api.com/docs/create-listings
//   POST https://api.reverb.com/api/listings
//   Headers: Authorization: Bearer <token>, Content-Type/Accept:
//            application/hal+json, Accept-Version: 3.0

import type { Condition } from "@/lib/types";
import { ListingConfigError, type ChannelMeta, type ListingChannel, type ListingInput, type ListingResult } from "./types";

function baseUrl(meta: ChannelMeta): string {
  return meta.sandbox ? "https://sandbox.reverb.com" : "https://api.reverb.com";
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/hal+json",
    Accept: "application/hal+json",
    "Accept-Version": "3.0",
  };
}

// Reverb's used-gear condition display names line up 1:1 with ours. The API
// wants a condition UUID, not a name — rather than hardcode UUIDs (they're easy
// to get subtly wrong and would silently mis-tag a listing), resolve them from
// the live /api/listing_conditions endpoint and cache per base URL.
const CONDITION_DISPLAY: Record<Condition, string> = {
  Mint: "Mint",
  Excellent: "Excellent",
  "Very Good": "Very Good",
  Good: "Good",
  Fair: "Fair",
  Poor: "Poor",
};

interface ConditionCache {
  byDisplay: Map<string, string>; // lower-cased display name → uuid
  fetchedAt: number;
}
const g = globalThis as unknown as { __reverbConditions?: Record<string, ConditionCache> };

async function conditionUuid(condition: Condition, token: string, meta: ChannelMeta): Promise<string> {
  const base = baseUrl(meta);
  g.__reverbConditions ??= {};
  const cached = g.__reverbConditions[base];
  // Cache for an hour — the condition list is effectively static.
  if (!cached || Date.now() - cached.fetchedAt > 3_600_000) {
    const res = await fetch(`${base}/api/listing_conditions`, { headers: headers(token) });
    if (!res.ok) {
      throw new ListingConfigError(`Reverb rejected the token while looking up conditions (HTTP ${res.status}). Check the personal access token.`);
    }
    const data = (await res.json()) as { conditions?: { uuid: string; display_name: string }[]; _embedded?: { conditions?: { uuid: string; display_name: string }[] } };
    const list = data.conditions ?? data._embedded?.conditions ?? [];
    const byDisplay = new Map<string, string>();
    for (const c of list) {
      if (c?.display_name && c?.uuid) byDisplay.set(c.display_name.trim().toLowerCase(), c.uuid);
    }
    g.__reverbConditions[base] = { byDisplay, fetchedAt: Date.now() };
  }
  const map = g.__reverbConditions[base].byDisplay;
  const uuid = map.get(CONDITION_DISPLAY[condition].toLowerCase());
  if (!uuid) {
    throw new ListingConfigError(`Could not map condition "${condition}" to a Reverb condition. Set the condition on the item, or adjust it on Reverb after the draft is created.`);
  }
  return uuid;
}

// Reverb renders the description as HTML, so plain newlines collapse into one
// run-on paragraph. Convert the assembled description (notes, a blank line, then
// one spec per line) to HTML: escape entities, then map newlines to <br>. A
// blank line (\n\n) becomes <br><br>; each spec's \n becomes a single <br> —
// exactly the notes → spaced → spec-per-line layout we want.
function descriptionHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>\n");
}

export const reverbChannel: ListingChannel = {
  slug: "reverb",
  label: "Reverb",

  async createDraft(input: ListingInput, token: string, meta: ChannelMeta): Promise<ListingResult> {
    const base = baseUrl(meta);

    // Reverb requires a condition to create a listing.
    if (!input.condition) {
      throw new ListingConfigError("Reverb needs a condition. Set the item's condition before listing.");
    }
    const condUuid = await conditionUuid(input.condition, token, meta);

    const body: Record<string, unknown> = {
      make: input.brand ?? undefined,
      model: input.model ?? undefined,
      title: input.title,
      description: descriptionHtml(input.description),
      condition: { uuid: condUuid },
      photos: input.photoUrls.slice(0, 25), // Reverb max 25 photos per listing
      // Reverb SKUs must be unique per shop and stay reserved even after a
      // listing is deleted — so a stable per-item SKU collides (HTTP 422) when
      // you delete on Reverb and re-draft. Suffix it per draft to keep the item
      // reference while guaranteeing uniqueness. (eBay keeps the stable SKU —
      // there it's the idempotent inventory-item key.)
      sku: `${input.sku}-${Date.now().toString(36)}`,
      publish: false, // DRAFT — never goes live automatically
    };
    if (input.year != null) body.year = String(input.year);
    if (input.price != null) {
      body.price = { amount: input.price.toFixed(2), currency: input.currency };
    }

    const res = await fetch(`${base}/api/listings`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }

    if (!res.ok) {
      const msg = (parsed as { message?: string } | null)?.message ?? text.slice(0, 300);
      throw new Error(`Reverb listing creation failed (HTTP ${res.status}): ${msg || "unknown error"}`);
    }

    const listing = (parsed as { listing?: Record<string, unknown> } | null)?.listing ?? (parsed as Record<string, unknown> | null) ?? {};
    const id = listing.id != null ? String(listing.id) : null;
    const links = (listing._links ?? {}) as Record<string, { href?: string }>;
    const url = links.web?.href ?? links.self?.href ?? (id ? `${base.replace("api.", "")}/item/${id}` : null);

    return { externalId: id, externalUrl: url, state: "draft", payload: body };
  },
};
