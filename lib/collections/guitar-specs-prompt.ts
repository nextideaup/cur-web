import type { GuitarItem } from "@/lib/types";
import { guitarConfig } from "./guitar";
import { buildSpecsPrompt } from "./specs-prompt";

export function guitarSpecsPrompt(item: GuitarItem): string {
  const descriptor = [item.year, item.brand, item.model, item.color_finish]
    .filter(Boolean)
    .join(" ");

  return buildSpecsPrompt({
    expertise: "guitars and music gear",
    descriptor,
    template: guitarConfig.specTemplate,
    extraGuidance:
      "For amplifiers and pedals, adapt the fields (e.g. wattage, tubes/circuit, channels, controls) instead of guitar-specific wood/pickup fields.",
    ownerNotes: item.notes,
  });
}
