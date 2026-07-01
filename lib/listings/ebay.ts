// eBay channel adapter (Sell Inventory API). Creates a DRAFT by doing the first
// two steps of the listing flow and deliberately NOT publishing:
//   1. PUT  /sell/inventory/v1/inventory_item/{sku}
//   2. POST /sell/inventory/v1/offer            → returns offerId (unpublished)
// We never call publishOffer, so nothing goes live — the offer sits in Seller
// Hub as a draft for the user to review and publish.
//
// Auth is a user OAuth access token (Bearer) with the sell.inventory scope.
// eBay needs account-specific identifiers to build an offer (category +
// location + business policies); those live in the credential's `meta` and a
// missing one raises ListingConfigError so the route can explain what to add.

import type { Condition } from "@/lib/types";
import { ListingConfigError, type ChannelMeta, type ListingChannel, type ListingInput, type ListingResult } from "./types";
import { getCategorySuggestion } from "./ebay-oauth";

function baseUrl(meta: ChannelMeta): string {
  return meta.sandbox ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "Content-Language": "en-US",
  };
}

// eBay condition enums (Inventory API). Mint maps to USED_EXCELLENT rather than
// NEW — these items are pre-owned by definition in this app.
const CONDITION_ENUM: Record<Condition, string> = {
  Mint: "USED_EXCELLENT",
  Excellent: "USED_EXCELLENT",
  "Very Good": "USED_VERY_GOOD",
  Good: "USED_GOOD",
  Fair: "USED_ACCEPTABLE",
  Poor: "FOR_PARTS_OR_NOT_WORKING",
};

async function errorText(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { errors?: { message?: string; longMessage?: string }[] };
    const e = j.errors?.[0];
    if (e) return e.longMessage || e.message || text.slice(0, 300);
  } catch { /* non-JSON */ }
  return text.slice(0, 300) || `HTTP ${res.status}`;
}

export const ebayChannel: ListingChannel = {
  slug: "ebay",
  label: "eBay",

  async createDraft(input: ListingInput, token: string, meta: ChannelMeta): Promise<ListingResult> {
    const base = baseUrl(meta);
    const marketplaceId = meta.marketplaceId || "EBAY_US";
    const currency = meta.currency || input.currency || "USD";

    // Leaf category is per-item: use a configured override if present, else
    // auto-detect it from the title via eBay's Taxonomy API.
    let categoryId = meta.categoryId;
    if (!categoryId) {
      const suggestion = await getCategorySuggestion(input.title, marketplaceId);
      categoryId = suggestion?.categoryId;
    }

    // The account-level identifiers (location + policies) still come from the
    // seller's saved settings. Collect any missing ones up front.
    const missing: string[] = [];
    if (!categoryId) missing.push("category (couldn't auto-detect one — set a categoryId in eBay settings)");
    if (!meta.merchantLocationKey) missing.push("merchantLocationKey");
    if (!meta.fulfillmentPolicyId) missing.push("fulfillmentPolicyId");
    if (!meta.paymentPolicyId) missing.push("paymentPolicyId");
    if (!meta.returnPolicyId) missing.push("returnPolicyId");
    if (missing.length > 0) {
      throw new ListingConfigError(
        `eBay needs more setup before it can draft a listing. Missing: ${missing.join(", ")}. Fill these in the eBay connection settings.`,
      );
    }
    if (!input.condition) {
      throw new ListingConfigError("eBay needs a condition. Set the item's condition before listing.");
    }
    if (input.price == null) {
      throw new ListingConfigError("eBay needs a price. Add an AI or manual valuation, or set a purchase price, before listing.");
    }

    // Aspects: Brand/Model + each spec as a single-value aspect. eBay enforces
    // required aspects only at publish time, so a draft tolerates a partial set.
    // eBay hard limits: aspect NAME ≤ 40 chars, VALUE ≤ 65 chars, and it rejects
    // the whole inventory item if any value overflows — so clip both. Our specs
    // can carry long values (e.g. a full electronics description), hence the cap.
    const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
    const aspects: Record<string, string[]> = {};
    if (input.brand) aspects["Brand"] = [clip(input.brand, 65)];
    if (input.model) aspects["Model"] = [clip(input.model, 65)];
    for (const s of input.specs) {
      const label = s.label?.trim();
      const value = s.value?.trim();
      if (!label || !value) continue;
      // Cap total aspects to stay well under eBay's per-listing ceiling.
      if (Object.keys(aspects).length >= 50) break;
      aspects[clip(label, 40)] = [clip(value, 65)];
    }

    // Step 1 — inventory item (idempotent on SKU).
    const invRes = await fetch(`${base}/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`, {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify({
        availability: { shipToLocationAvailability: { quantity: 1 } },
        condition: CONDITION_ENUM[input.condition],
        product: {
          title: input.title.slice(0, 80), // eBay title cap
          description: input.description,
          aspects,
          imageUrls: input.photoUrls.slice(0, 24), // eBay max 24 images
        },
      }),
    });
    if (!invRes.ok) {
      throw new Error(`eBay inventory item create failed (HTTP ${invRes.status}): ${await errorText(invRes)}`);
    }

    // Step 2 — offer (unpublished). NOT followed by publishOffer.
    const offerBody = {
      sku: input.sku,
      marketplaceId,
      format: "FIXED_PRICE",
      availableQuantity: 1,
      categoryId,
      listingDescription: input.description,
      listingPolicies: {
        fulfillmentPolicyId: meta.fulfillmentPolicyId,
        paymentPolicyId: meta.paymentPolicyId,
        returnPolicyId: meta.returnPolicyId,
      },
      pricingSummary: { price: { value: input.price.toFixed(2), currency } },
      merchantLocationKey: meta.merchantLocationKey,
    };
    const offerRes = await fetch(`${base}/sell/inventory/v1/offer`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(offerBody),
    });
    if (!offerRes.ok) {
      throw new Error(`eBay offer create failed (HTTP ${offerRes.status}): ${await errorText(offerRes)}`);
    }
    const offer = (await offerRes.json()) as { offerId?: string };
    const offerId = offer.offerId ?? null;

    return {
      externalId: offerId,
      // Unpublished offers have no public URL; point at Seller Hub drafts.
      externalUrl: meta.sandbox ? null : "https://www.ebay.com/sh/lst/drafts",
      state: "draft",
      payload: { inventory_item_sku: input.sku, offer: offerBody },
    };
  },
};
