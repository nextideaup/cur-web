// Robustly extract a single JSON object from model output that may contain
// prose, markdown code fences, web_search citations, or multiple braced
// fragments. Shared by the valuation handler (lib/valuation-handler.ts) and the
// specs handler (lib/specs-handler.ts) — both prompt Claude for "ONLY JSON" but
// web_search turns sometimes leave a preamble or trailing citation behind.
//
// Strategy in order of preference:
//   1. Pull a fenced ```json block; try to parse it.
//   2. Walk the string for balanced-brace regions, parse each, and keep the
//      LARGEST one that parses successfully. This handles preambles like
//      `Looking at the {prior search} results, here's the result: { … }` that
//      would defeat a naive indexOf('{') / lastIndexOf('}') slice.
//   3. Try parsing the whole text as a last resort.
export function extractJSON(text: string): string | null {
  const cleaned = text.trim();

  // 1) Fenced ```json
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const candidate = fence[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch { /* fall through */ }
  }

  // 2) Largest balanced-brace block. Walk every `{`, track depth, find its
  //    matching `}`, try to parse the slice. Keep the longest one that parses.
  let bestCandidate: string | null = null;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = i; j < cleaned.length; j++) {
      const ch = cleaned[j];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const candidate = cleaned.slice(i, j + 1);
          try {
            JSON.parse(candidate);
            if (!bestCandidate || candidate.length > bestCandidate.length) {
              bestCandidate = candidate;
            }
          } catch { /* not valid, keep walking */ }
          break;  // move on to the next `{`
        }
      }
    }
  }
  if (bestCandidate) return bestCandidate;

  // 3) Last resort — parse the whole thing.
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch { /* fall through */ }

  return null;
}
