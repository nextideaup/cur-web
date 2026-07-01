import type { WatchItem } from "@/lib/types";
import { watchConfig } from "./watch";
import { buildSpecsPrompt } from "./specs-prompt";

export function watchSpecsPrompt(item: WatchItem): string {
  const descriptor = [item.year, item.brand, item.model, item.reference_number]
    .filter(Boolean)
    .join(" ");

  return buildSpecsPrompt({
    expertise: "watches and horology",
    descriptor,
    template: watchConfig.specTemplate,
    extraGuidance:
      "Use the reference number to pin down the exact variant when available; movement caliber and case dimensions are the highest-value fields for resale.",
    ownerNotes: item.notes,
  });
}
