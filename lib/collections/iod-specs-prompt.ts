import type { IoDItem } from "@/lib/types";
import { iodConfig } from "./iod";
import { buildSpecsPrompt } from "./specs-prompt";

export function iodSpecsPrompt(item: IoDItem): string {
  const descriptor = [item.year, item.brand, item.item_type, item.short_description]
    .filter(Boolean)
    .join(" ");

  return buildSpecsPrompt({
    expertise: "fine art, collectibles, and items of distinction",
    descriptor,
    template: iodConfig.specTemplate,
    extraGuidance:
      "Items here are often unique — focus on attributes that establish identity and authenticity (medium, dimensions, edition/numbering, markings, provenance). Omit fields that don't apply to this kind of object.",
    ownerNotes: item.notes,
  });
}
