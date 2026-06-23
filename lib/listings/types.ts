// Channel-agnostic contract for the marketplace listing integration (CUR-1).
// The per-module list route builds a normalized ListingInput from an item +
// its specs + photos, then hands it to the selected channel adapter. Adapters
// (lib/listings/reverb.ts, lib/listings/ebay.ts) translate it to the
// marketplace's payload and create a DRAFT (unpublished) listing.

import type { Condition, SpecEntry } from "@/lib/types";

export type ListingChannelSlug = "reverb" | "ebay";

// Non-secret per-channel config stored in marketplace_credentials.meta.
// Reverb needs nothing here. eBay needs account-specific identifiers to even
// create a draft offer (a listing has to reference a location + business
// policies + leaf category), so they ride in meta alongside the token.
export interface ChannelMeta {
  sandbox?: boolean;
  // eBay-only:
  marketplaceId?: string;         // e.g. "EBAY_US"
  merchantLocationKey?: string;   // from the eBay Inventory Location API
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  categoryId?: string;            // leaf category for the offer
  currency?: string;              // defaults to USD
}

// Normalized item passed to every adapter.
export interface ListingInput {
  module: string;
  itemId: string;
  title: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  condition: Condition | null;
  description: string;     // assembled from short/long description + specs
  price: number | null;    // suggested sale price (latest AI or user value)
  currency: string;
  photoUrls: string[];     // absolute, publicly fetchable URLs
  specs: SpecEntry[];
  sku: string;             // stable per-item identifier for the marketplace
}

export interface ListingResult {
  externalId: string | null;   // marketplace listing/offer id
  externalUrl: string | null;  // link to view/manage it
  state: "draft" | "published" | "error";
  // Raw request we sent (persisted to marketplace_listings.payload for debug).
  payload: unknown;
}

// Raised by an adapter when the user's stored config is insufficient to build a
// draft (e.g. eBay missing a category or location). Carries a user-facing
// message and a 400 so the route can relay it without a generic 500.
export class ListingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListingConfigError";
  }
}

export interface ListingChannel {
  slug: ListingChannelSlug;
  label: string;
  // Create an unpublished/draft listing. `token` is the decrypted credential;
  // `meta` is the non-secret config from marketplace_credentials.meta.
  createDraft(input: ListingInput, token: string, meta: ChannelMeta): Promise<ListingResult>;
}
