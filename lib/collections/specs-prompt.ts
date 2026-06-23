// Shared builder for the per-module AI specs prompts. Each module's
// <module>-specs-prompt.ts computes an item descriptor and passes its
// CollectionConfig.specTemplate here. The output asks Claude to web_search for
// manufacturer-grade specifications and return a flat label/value JSON list.

export function buildSpecsPrompt(opts: {
  expertise: string;            // e.g. "guitars and music gear"
  descriptor: string;           // e.g. "1959 Gibson Les Paul Standard"
  template: readonly string[];  // suggested spec labels for this module
  extraGuidance?: string;       // optional module-specific note
}): string {
  const { expertise, descriptor, template, extraGuidance } = opts;
  const templateList = template.map((t) => `- ${t}`).join("\n");

  return `You are a ${expertise} specifications expert. Research the factory/manufacturer specifications for: ${descriptor}.

Use web search to find authoritative sources — manufacturer spec sheets, catalogues, reputable retailer/dealer listings, or well-known reference databases. Prefer specifications for this exact model and year/variant.

Aim to fill in these spec fields where they apply (use these exact labels when you have the value):
${templateList}

Guidelines:
- Only include a field if you found a credible value. OMIT anything you cannot determine rather than guessing — a wrong spec is worse than a missing one.
- You MAY add extra relevant spec rows beyond the list above if they're meaningful for this item and would help someone resell it.
- Keep each value concise (a few words — e.g. "Mahogany", "25.5 in (648 mm)", "3x Single-coil"). No sentences.
- Do not include price, condition, valuation, or availability — those live elsewhere.${extraGuidance ? `\n- ${extraGuidance}` : ""}

After researching, respond with ONLY valid JSON (no markdown, no commentary) in this exact format:
{
  "specs": [
    { "label": "<spec name>", "value": "<spec value>" }
  ]
}

If you cannot find any reliable specifications, return {"specs": []}.`;
}
