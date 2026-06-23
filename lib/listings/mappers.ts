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
  const lead = item.short_description?.trim() || item.description?.trim();
  if (lead) parts.push(lead);
  if (item.long_description?.trim()) parts.push(item.long_description.trim());
  if (item.notes?.trim()) parts.push(item.notes.trim());

  const specs = (item.specs ?? []).filter((s) => s?.label?.trim() && s?.value?.trim());
  if (specs.length > 0) {
    parts.push(["Specifications:", ...specs.map((s) => `- ${s.label}: ${s.value}`)].join("\n"));
  }
  return parts.join("\n\n") || buildTitle(item);
}

export function buildListingInput(
  module: string,
  item: RawListItem,
  opts: { price: number | null; photoUrls: string[]; currency: string },
): ListingInput {
  return {
    module,
    itemId: item.id,
    title: buildTitle(item),
    brand: item.brand ?? null,
    model: item.model ?? null,
    year: item.year ?? null,
    condition: item.condition ?? null,
    description: buildDescription(item),
    price: opts.price,
    currency: opts.currency,
    photoUrls: opts.photoUrls,
    specs: item.specs ?? [],
    // Stable per-item SKU so re-listing updates the same marketplace record
    // rather than spawning duplicates.
    sku: `vault1-${module}-${item.id}`,
  };
}
