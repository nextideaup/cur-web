/**
 * Pursuit Search Agent
 *
 * For each active pursuit, sends a web-search-enabled Claude request for
 * every selected platform. Parsed listings are upserted into pursuit_findings —
 * duplicate URLs are detected by the UNIQUE constraint and only update
 * last_seen_at / price on subsequent runs.
 */

import Anthropic from "@anthropic-ai/sdk";
import { query } from "@/lib/db";
import { GuitarPursuit, WatchPursuit, AutoPursuit, IoDPursuit } from "@/lib/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Required to enable the server-side web search beta tool
  defaultHeaders: { "anthropic-beta": "web-search-2025-03-05" },
});

// ── Source → site domain mapping ─────────────────────────────────────────────

const SOURCE_SITES: Record<string, string> = {
  reverb:             "reverb.com",
  ebay:               "ebay.com",
  guitar_center:      "guitarcenter.com",
  sweetwater:         "sweetwater.com",
  chrono24:           "chrono24.com",
  watchbox:           "thewatchbox.com",
  bobs_watches:       "bobswatches.com",
  jomashop:           "jomashop.com",
  facebook:           "facebook.com/marketplace",
  craigslist:         "craigslist.org",
  google:             "google.com/shopping",
  autotrader:         "autotrader.com",
  cars_com:           "cars.com",
  cargurus:           "cargurus.com",
  ebay_motors:        "ebay.com/motors",
  bring_a_trailer:    "bringatrailer.com",
  carmax:             "carmax.com",
  heritage_auctions:  "ha.com",
  sothebys:           "sothebys.com",
  christies:          "christies.com",
  invaluable:         "invaluable.com",
};

// ── Query builders ────────────────────────────────────────────────────────────

function guitarQuery(p: GuitarPursuit): string {
  const parts: string[] = [];
  if (p.brand)        parts.push(p.brand);
  if (p.model)        parts.push(p.model);
  if (p.year_min && p.year_min === p.year_max) {
    parts.push(String(p.year_min));
  } else if (p.year_min || p.year_max) {
    parts.push([p.year_min, p.year_max].filter(Boolean).join("–"));
  }
  if (p.color_finish) parts.push(p.color_finish);
  return parts.join(" ");
}

function autoQuery(p: AutoPursuit): string {
  const parts: string[] = [];
  if (p.brand) parts.push(p.brand);
  if (p.model) parts.push(p.model);
  if (p.year_min && p.year_min === p.year_max) {
    parts.push(String(p.year_min));
  } else if (p.year_min || p.year_max) {
    parts.push([p.year_min, p.year_max].filter(Boolean).join("–"));
  }
  if (p.body_style) parts.push(p.body_style);
  if (p.color)      parts.push(p.color);
  return parts.join(" ");
}

function iodQuery(p: IoDPursuit): string {
  const parts: string[] = [];
  if (p.brand)       parts.push(p.brand);
  if (p.item_type)   parts.push(p.item_type);
  if (p.description) parts.push(p.description);
  return parts.join(" ");
}

function watchQuery(p: WatchPursuit): string {
  const parts: string[] = [];
  if (p.brand)            parts.push(p.brand);
  if (p.model)            parts.push(p.model);
  if (p.reference_number) parts.push(p.reference_number);
  if (p.dial_color)       parts.push(p.dial_color);
  if (p.case_diameter)    parts.push(p.case_diameter);
  return parts.join(" ");
}

// ── Single-platform search via Claude web search ──────────────────────────────

interface RawListing {
  title?: string;
  url?: string;
  price?: number | string | null;
  condition?: string | null;
  availability?: string | null;
  location?: string | null;
  days_listed?: number | null;
  listed_date?: string | null;
  image_url?: string | null;
}

async function searchPlatform(
  source: string,
  itemQuery: string,
  priceMin: number | null,
  priceMax: number | null,
  location: string | null,
  itemType: "guitar" | "watch" | "auto" | "iod",
  excludeTerms: string | null = null,
): Promise<RawListing[]> {
  const site = SOURCE_SITES[source] ?? source;

  const locationNote = location ? ` Near: ${location}.` : "";

  // Hard price-range constraint lines
  const priceLines: string[] = [];
  if (priceMin != null && priceMax != null) {
    priceLines.push(`PRICE FILTER (hard rule): Only include listings priced between $${priceMin} and $${priceMax}.`);
    priceLines.push(`Do NOT include any listing whose price is below $${priceMin} or above $${priceMax}.`);
    priceLines.push(`If a listing has no visible price, include it (we cannot verify it from the snippet).`);
  } else if (priceMin != null) {
    priceLines.push(`PRICE FILTER (hard rule): Only include listings priced at $${priceMin} or more.`);
    priceLines.push(`Do NOT include any listing priced below $${priceMin}.`);
    priceLines.push(`If a listing has no visible price, include it.`);
  } else if (priceMax != null) {
    priceLines.push(`PRICE FILTER (hard rule): Only include listings priced at $${priceMax} or less.`);
    priceLines.push(`Do NOT include any listing priced above $${priceMax}.`);
    priceLines.push(`If a listing has no visible price, include it.`);
  }
  const priceConstraint = priceLines.length ? `\n\n${priceLines.join("\n")}` : "";

  // Build exclusion note from comma-separated exclude_terms
  const excludeList = excludeTerms
    ? excludeTerms.split(",").map(t => t.trim()).filter(Boolean)
    : [];
  const excludeNote = excludeList.length
    ? `\n\nTERMS TO EXCLUDE (hard rule): Do NOT include any listing whose title contains any of these words (case-insensitive): ${excludeList.map(t => `"${t}"`).join(", ")}. Omit those listings entirely.`
    : "";

  const prompt = `
Use the web_search tool to search for: site:${site} "${itemQuery}" for sale${locationNote}

Search the web now. Look through every search result snippet carefully.
Return ALL matching listings you can identify on ${site} — even if you only know the title and URL.
It is MUCH better to return a listing with null fields than to skip it entirely.${priceConstraint}${excludeNote}

AVAILABILITY (hard rule): EXCLUDE any listing that is sold, out of stock, discontinued, backordered, unavailable, or no longer for sale. Only include items that are currently available to purchase. If the availability is unclear from the snippet, include the listing and set availability to null.

After searching, respond with ONLY a JSON array — no explanation, no preamble, no markdown code fence.
Each object must have these fields (use null for anything you cannot determine):
  title        — string or null
  url          — string (full URL) or null — include only if you're confident it's a real listing page
  price        — number (USD, no symbols) or null
  condition    — string or null
  availability — "available", "sold", "out of stock", or null
  location     — string or null
  days_listed  — integer or null
  listed_date  — "YYYY-MM-DD" or null

Example (respond exactly like this, nothing else):
[{"title":"Gibson Les Paul Standard 59 Cherry Sunburst","url":"https://reverb.com/item/abc123","price":4200,"condition":"Good","availability":"available","location":"Austin, TX","days_listed":12,"listed_date":"2026-03-11"},{"title":"Gibson LP Standard Cherry Sunburst 2019","url":"https://reverb.com/item/xyz456","price":null,"condition":null,"availability":null,"location":null,"days_listed":null,"listed_date":null}]

If you truly find zero matching listings after searching, return exactly: []
`.trim();

  console.log(`[pursuit-search] Searching ${source} for: ${itemQuery}`);

  try {
    // web_search_20250305 is a server-side beta tool — Anthropic's infrastructure
    // executes the searches. The beta header is set on the client via defaultHeaders.
    // Not yet typed in the SDK, so we cast to any.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await (anthropic.messages.create as any)({
      model:      "claude-haiku-4-5",
      max_tokens: 4096,
      system:     "You are a listing extractor. You MUST end every response with a JSON array of listings. " +
                  "Never write explanations after the JSON. Never refuse to output JSON. " +
                  "If you find listings but lack some fields, include the listing with null for unknown fields. " +
                  "Your entire response must conclude with a valid JSON array — even if it is [].",
      tools:      [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      messages:   [{ role: "user", content: prompt }],
    });

    // Anthropic SDK ContentBlock shape (subset we use here). The web_search beta
    // returns additional block types not yet exported by the SDK; we narrow to
    // `text` blocks via the `type` discriminator.
    type ContentBlock = { type: string; text?: string };
    const blocks: ContentBlock[] = response.content;

    console.log(`[pursuit-search] ${source} → stop_reason=${response.stop_reason}, blocks=${blocks.length}`);
    console.log(`[pursuit-search] ${source} block types:`, blocks.map((b) => b.type).join(", "));

    // Extract all text blocks (the model weaves final answer text among tool-call blocks)
    const textContent = blocks
      .filter((b): b is ContentBlock & { text: string } => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("");

    console.log(`[pursuit-search] ${source} text length: ${textContent.length}`);
    console.log(`[pursuit-search] ${source} text preview: ${textContent.slice(0, 400)}`);

    // Extract the outermost JSON array — use greedy match so nested objects/arrays
    // are captured fully (non-greedy would stop at the first "]")
    const start = textContent.indexOf("[");
    const end   = textContent.lastIndexOf("]");
    if (start === -1 || end === -1 || end < start) {
      console.log(`[pursuit-search] ${source}: no JSON array found in response`);
      return [];
    }

    const parsed: unknown = JSON.parse(textContent.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    console.log(`[pursuit-search] ${source}: parsed ${parsed.length} listings`);
    return parsed as RawListing[];
  } catch (err) {
    console.error(`[pursuit-search] Error searching ${source}:`, err);
    return [];
  }
}

// ── Price range filter (safety net after AI response) ────────────────────────

function filterByPrice(
  listings: RawListing[],
  priceMin: number | null,
  priceMax: number | null,
): RawListing[] {
  if (priceMin == null && priceMax == null) return listings;
  const before = listings.length;
  const filtered = listings.filter((l) => {
    if (l.price == null) return true; // no price info — keep it, can't verify
    const price = parseFloat(String(l.price));
    if (isNaN(price)) return true;
    if (priceMin != null && price < priceMin) return false;
    if (priceMax != null && price > priceMax) return false;
    return true;
  });
  const dropped = before - filtered.length;
  if (dropped > 0) {
    console.log(`[pursuit-search] Price filter: dropped ${dropped} out-of-range listing(s)`);
  }
  return filtered;
}

// ── Availability filter (safety net after AI response) ────────────────────────

const UNAVAILABLE_PATTERNS = [
  /\bsold\b/i,
  /\bout[\s-]of[\s-]stock\b/i,
  /\bunavailable\b/i,
  /\bdiscontinued\b/i,
  /\bbackorder(ed)?\b/i,
  /\bno longer available\b/i,
  /\blisting.{0,10}ended\b/i,
  /\bitem.{0,10}sold\b/i,
];

function isUnavailable(l: RawListing): boolean {
  // Explicit availability field set by Claude
  if (l.availability && /sold|out.of.stock|unavailable|discontinued|backordered/i.test(l.availability)) {
    return true;
  }
  // Scan title for common unavailability signals
  const text = [l.title, l.condition].filter(Boolean).join(" ");
  return UNAVAILABLE_PATTERNS.some((re) => re.test(text));
}

function filterUnavailable(listings: RawListing[]): RawListing[] {
  const before = listings.length;
  const filtered = listings.filter((l) => !isUnavailable(l));
  const dropped = before - filtered.length;
  if (dropped > 0) {
    console.log(`[pursuit-search] Availability filter: dropped ${dropped} sold/OOS listing(s)`);
  }
  return filtered;
}

// ── Upsert findings into DB ───────────────────────────────────────────────────

async function saveFindings(
  pursuitType: "guitar" | "watch" | "auto" | "iod",
  pursuitId:   string,
  source:      string,
  listings:    RawListing[],
): Promise<number> {
  let saved = 0;
  for (const l of listings) {
    if (!l.url || typeof l.url !== "string" || !l.url.startsWith("http")) continue;

    const price = l.price != null ? parseFloat(String(l.price)) : null;
    const listedAt = l.listed_date && typeof l.listed_date === "string"
      ? l.listed_date
      : null;

    await query(`
      INSERT INTO pursuit_findings
        (pursuit_type, pursuit_id, source, title, url, price, condition,
         location, days_listed, listed_at, image_url, extra, first_seen_at, last_seen_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz,$11,$12::jsonb, NOW(), NOW())
      ON CONFLICT (pursuit_type, pursuit_id, url) DO UPDATE SET
        price        = EXCLUDED.price,
        days_listed  = EXCLUDED.days_listed,
        last_seen_at = NOW()
    `, [
      pursuitType,
      pursuitId,
      source,
      l.title   ?? null,
      l.url,
      isNaN(price as number) ? null : price,
      l.condition  ?? null,
      l.location   ?? null,
      l.days_listed ?? null,
      listedAt,
      l.image_url  ?? null,
      "{}",
    ]);
    saved++;
  }
  return saved;
}

// ── Public API ────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function runGuitarPursuitSearch(pursuit: GuitarPursuit): Promise<number> {
  const q = guitarQuery(pursuit);
  let total = 0;
  for (const source of (pursuit.sources ?? [])) {
    const raw = await searchPlatform(
      source, q, pursuit.price_min, pursuit.price_max, pursuit.facebook_location, "guitar", pursuit.exclude_terms ?? null
    );
    const listings = filterUnavailable(filterByPrice(raw, pursuit.price_min, pursuit.price_max));
    total += await saveFindings("guitar", pursuit.id, source, listings);
    // Throttle to avoid hitting the 50k token/min rate limit
    await delay(3000);
  }
  return total;
}

export async function runWatchPursuitSearch(pursuit: WatchPursuit): Promise<number> {
  const q = watchQuery(pursuit);
  let total = 0;
  for (const source of (pursuit.sources ?? [])) {
    const label = source === "other" ? (pursuit.other_source ?? "other") : source;
    const raw = await searchPlatform(
      source, q, pursuit.price_min, pursuit.price_max, pursuit.facebook_location, "watch", pursuit.exclude_terms ?? null
    );
    const listings = filterUnavailable(filterByPrice(raw, pursuit.price_min, pursuit.price_max));
    total += await saveFindings("watch", pursuit.id, label, listings);
    // Throttle to avoid hitting the 50k token/min rate limit
    await delay(3000);
  }
  return total;
}

export async function runAutoPursuitSearch(pursuit: AutoPursuit): Promise<number> {
  const q = autoQuery(pursuit);
  let total = 0;
  for (const source of (pursuit.sources ?? [])) {
    const raw = await searchPlatform(
      source, q, pursuit.price_min, pursuit.price_max, pursuit.facebook_location ?? null, "auto", pursuit.exclude_terms ?? null
    );
    const listings = filterUnavailable(filterByPrice(raw, pursuit.price_min, pursuit.price_max));
    total += await saveFindings("auto", pursuit.id, source, listings);
    await delay(3000);
  }
  return total;
}

export async function runIoDPursuitSearch(pursuit: IoDPursuit): Promise<number> {
  const q = iodQuery(pursuit);
  let total = 0;
  for (const source of (pursuit.sources ?? [])) {
    const raw = await searchPlatform(
      source, q, pursuit.price_min, pursuit.price_max, null, "iod", pursuit.exclude_terms ?? null
    );
    const listings = filterUnavailable(filterByPrice(raw, pursuit.price_min, pursuit.price_max));
    total += await saveFindings("iod", pursuit.id, source, listings);
    await delay(3000);
  }
  return total;
}
