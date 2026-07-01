// Builds the channel-agnostic ListingInput from a collection item row + its
// specs + photos. One mapper for all four modules — the per-module shape
// differences (guitars/watches have brand+model, IoD leads with a description)
// are handled by falling back through the available fields.

import type { Condition, SpecEntry } from "@/lib/types";
import type { ListingInput } from "./types";

// Loose shape covering the union of the four item tables' columns we read.
export interface RawListItem {
  id: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  condition?: Condition | null;
  trim_level?: string | null;
  item_type?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  description?: string | null;
  notes?: string | null;
  specs?: SpecEntry[] | null;
  listing_intro?: string | null;
  package_weight_lb?: number | string | null;
  package_length_in?: number | string | null;
  package_width_in?: number | string | null;
  package_height_in?: number | string | null;
}

// NUMERIC columns arrive from pg as strings — coerce to a positive number or null.
function num(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildTitle(item: RawListItem): string {
  const primary = [item.year, item.brand, item.model, item.trim_level]
    .filter((v) => v != null && String(v).trim() !== "")
    .join(" ")
    .trim();
  return primary || item.short_description?.trim() || item.item_type?.trim() || "Untitled item";
}

function buildDescription(item: RawListItem): string {
  const parts: string[] = [];
  const intro = item.listing_intro?.trim();
  if (intro) {
    // A generated/edited listing intro is the polished opening — it supersedes
    // the raw short/long description and notes prose (which it was written from).
    parts.push(intro);
  } else {
    const lead = item.short_description?.trim() || item.description?.trim();
    if (lead) parts.push(lead);
    if (item.long_description?.trim()) parts.push(item.long_description.trim());
    if (item.notes?.trim()) parts.push(item.notes.trim());
  }

  const specs = (item.specs ?? []).filter((s) => s?.label?.trim() && s?.value?.trim());
  if (specs.length > 0) {
    parts.push(["Specifications:", ...specs.map((s) => `- ${s.label}: ${s.value}`)].join("\n"));
  }
  return parts.join("\n\n") || buildTitle(item);
}

export function buildListingInput(
  module: string,
  item: RawListItem,
  opts: { price: number | null; photoUrls: string[]; currency: string; footer?: string | null },
): ListingInput {
  // Description = intro/notes + specs, then the boilerplate footer (resolved by
  // the caller: item override → user default → built-in).
  const description = [buildDescription(item), opts.footer?.trim()].filter(Boolean).join("\n\n");
  return {
    module,
    itemId: item.id,
    title: buildTitle(item),
    brand: item.brand ?? null,
    model: item.model ?? null,
    year: item.year ?? null,
    condition: item.condition ?? null,
    description,
    price: opts.price,
    currency: opts.currency,
    photoUrls: opts.photoUrls,
    specs: item.specs ?? [],
    // Stable per-item SKU so re-listing updates the same marketplace record
    // rather than spawning duplicates.
    sku: `vault1-${module}-${item.id}`,
    packageWeightLb: num(item.package_weight_lb),
    packageLengthIn: num(item.package_length_in),
    packageWidthIn: num(item.package_width_in),
    packageHeightIn: num(item.package_height_in),
  };
}
