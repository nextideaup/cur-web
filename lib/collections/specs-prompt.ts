// Shared builder for the per-module AI specs prompts. Each module's
// <module>-specs-prompt.ts computes an item descriptor and passes its
// CollectionConfig.specTemplate here. The output asks Claude to web_search for
// manufacturer-grade specifications and return a flat label/value JSON list.

export function buildSpecsPrompt(opts: {
  expertise: string;            // e.g. "guitars and music gear"
  descriptor: string;           // e.g. "1959 Gibson Les Paul Standard"
  template: readonly string[];  // suggested spec labels for this module
  extraGuidance?: string;       // optional module-specific note
  ownerNotes?: string | null;   // the item's free-text notes (may list mods)
}): string {
  const { expertise, descriptor, template, extraGuidance, ownerNotes } = opts;
  const templateList = template.map((t) => `- ${t}`).join("\n");

  // When the owner's notes call out non-original parts, those override the
  // factory spec for THIS specific item (e.g. "SD 59 pickups" replaces the
  // stock pickups). This is the difference between a catalogue spec and an
  // accurate flip/sell listing.
  const notes = ownerNotes?.trim();
  const notesBlock = notes
    ? `

OWNER'S NOTES — authoritative for THIS specific item (may describe modifications or non-original parts):
"""
${notes}
"""
Where the notes indicate a part differs from the factory/stock spec (e.g. replaced pickups, tuners, bridge, pots, hardware), set that spec's value to the ACTUAL part described and OVERRIDE the stock value. Interpret common abbreviations (e.g. "SD 59" → "Seymour Duncan '59", "CTS pots" → "CTS potentiometers"). Mark it as aftermarket where useful (e.g. "Seymour Duncan '59 (aftermarket)"). Use the notes only for spec-relevant details — ignore unrelated commentary such as price, condition, or purchase history. Research the factory specs for everything the notes do NOT change.`
    : "";

  return `You are a ${expertise} specifications expert. Research the factory/manufacturer specifications for: ${descriptor}.

Use web search to find authoritative sources — manufacturer spec sheets, catalogues, reputable retailer/dealer listings, or well-known reference databases. Prefer specifications for this exact model and year/variant.

Aim to fill in these spec fields where they apply (use these exact labels when you have the value):
${templateList}

Guidelines:
- Only include a field if you found a credible value. OMIT anything you cannot determine rather than guessing — a wrong spec is worse than a missing one.
- You MAY add extra relevant spec rows beyond the list above if they're meaningful for this item and would help someone resell it.
- Keep each value concise (a few words — e.g. "Mahogany", "25.5 in (648 mm)", "3x Single-coil"). No sentences.
- Do not include price, condition, valuation, or availability — those live elsewhere.${extraGuidance ? `\n- ${extraGuidance}` : ""}${notesBlock}

After researching, respond with ONLY valid JSON (no markdown, no commentary) in this exact format:
{
  "specs": [
    { "label": "<spec name>", "value": "<spec value>" }
  ]
}

If you cannot find any reliable specifications, return {"specs": []}.`;
}
