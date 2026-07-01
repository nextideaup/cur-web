import type { AutoItem } from "@/lib/types";
import { autoConfig } from "./auto";
import { buildSpecsPrompt } from "./specs-prompt";

export function autoSpecsPrompt(item: AutoItem): string {
  const descriptor = [item.year, item.brand, item.model, item.trim_level]
    .filter(Boolean)
    .join(" ");

  return buildSpecsPrompt({
    expertise: "automobiles",
    descriptor,
    template: autoConfig.specTemplate,
    extraGuidance:
      "Use the trim level to select the correct engine/output figures; report manufacturer figures (not a specific used example's odometer).",
    ownerNotes: item.notes,
  });
}
