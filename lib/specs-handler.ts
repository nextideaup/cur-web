// Shared AI-specs route factory for the four collection modules. Mirrors
// lib/valuation-handler.ts: the per-module prompt is the only real difference;
// auth, item lookup, the Anthropic web_search call with retry, JSON extraction,
// and the merge-preserving-manual write are identical across guitars, watches,
// automobiles, and items of distinction.
//
// "Specs" are the structured detail a flip/sell listing needs (body wood /
// pickups / scale length for a guitar, movement / case size / lug width for a
// watch, …). This handler researches them via web_search and writes them to the
// item's `specs` JSONB column (migration 019).
//
// IMPORTANT — manual overrides survive. mergeSpecs keeps every existing
// source='manual' entry and only replaces the source='ai' rows. Re-running AI
// generation never clobbers a value the user typed by hand.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getApiSession } from "@/lib/api-auth";
import { query, queryOne } from "@/lib/db";
import type { CollectionConfig } from "@/lib/collections/types";
import type { SpecEntry } from "@/lib/types";
import { extractJSON } from "@/lib/ai/extract-json";

const client = new Anthropic();

// The shape the model is asked to return: a flat list of label/value pairs.
interface SpecsResult {
  specs: { label: string; value: string }[];
}

// Minimum the handler needs off the item row; each module's item type is a
// structural superset, so callers pass GuitarItem/WatchItem/etc. unchanged.
interface SpecableItem {
  id: string;
  specs?: SpecEntry[] | null;
}

// Merge freshly-researched AI entries with the item's existing specs, keeping
// every manual override and dropping any AI row that collides (case-insensitive
// label) with one. Exported so the batch route / tests can reuse it.
export function mergeSpecs(
  existing: SpecEntry[] | null | undefined,
  aiEntries: { label: string; value: string }[],
): SpecEntry[] {
  const manual = (existing ?? []).filter(
    (e) => e?.source === "manual" && e.label?.trim() && e.value?.trim(),
  );
  const manualLabels = new Set(manual.map((e) => e.label.trim().toLowerCase()));

  const seen = new Set<string>();
  const ai: SpecEntry[] = [];
  for (const e of aiEntries ?? []) {
    if (!e || typeof e.label !== "string" || typeof e.value !== "string") continue;
    const label = e.label.trim();
    const value = e.value.trim();
    if (!label || !value) continue;
    const key = label.toLowerCase();
    if (manualLabels.has(key) || seen.has(key)) continue; // manual wins; de-dupe AI
    seen.add(key);
    ai.push({ label, value, source: "ai" });
  }

  return [...ai, ...manual];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface AnthropicResponse {
  content: { type: string; text: string }[];
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
}

async function callWithRetry(prompt: string, maxRetries = 3): Promise<AnthropicResponse> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Same model/budget rationale as the valuation handler: Haiku is plenty
      // for this lookup task at ~1/5 the cost, and 8192 tokens gives headroom
      // for the model to read verbose web_search results before emitting JSON.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (client.messages.create as any)({
        model: "claude-haiku-4-5",
        max_tokens: 8192,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 2,
          },
        ],
        messages: [{ role: "user", content: prompt }],
      });
      return response as AnthropicResponse;
    } catch (err: unknown) {
      const apiErr = err as { status?: number; headers?: Record<string, string> };
      if (apiErr?.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(apiErr.headers?.["retry-after"] ?? "60", 10);
        console.log(`[specs] Rate limited. Waiting ${retryAfter}s before retry ${attempt + 1}/${maxRetries}...`);
        await sleep(retryAfter * 1000);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

export function makeSpecsHandler<T extends SpecableItem>(
  c: CollectionConfig,
  buildPrompt: (item: T) => string,
) {
  // Next 15: params is a Promise; await before reading.
  return async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    try {
      const session = await getApiSession(request);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { id } = await params;

      const item = await queryOne<T>(
        `SELECT * FROM ${c.table} WHERE id = $1 AND user_id = $2`,
        [id, session.user.id],
      );
      if (!item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }

      const prompt = buildPrompt(item);
      const response = await callWithRetry(prompt);

      const textBlocks = response.content.filter((b) => b.type === "text");
      const allText = textBlocks.map((b) => b.text).join("\n");
      const jsonText = extractJSON(allText);

      if (!jsonText) {
        const diag = {
          model: response.model,
          stop_reason: response.stop_reason,
          usage: response.usage,
          block_types: response.content.map((b) => b.type),
          text_block_count: textBlocks.length,
          content_length: allText.length,
        };
        console.error(
          `[specs] No parseable JSON in AI response for ${c.label} id=${id}`,
          { ...diag, content: allText },
        );
        const reason =
          textBlocks.length === 0
            ? `model produced no text block (stop_reason: ${diag.stop_reason ?? "unknown"}) — likely ran out of token budget during web search`
            : `model returned ${diag.content_length} chars with no parseable JSON (stop_reason: ${diag.stop_reason ?? "unknown"})`;
        return NextResponse.json(
          { error: `AI specs lookup failed: ${reason}. This has been logged.`, debug: diag },
          { status: 502 },
        );
      }

      let parsed: SpecsResult;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        console.error(`[specs] Failed to parse extracted JSON for ${c.label} id=${id}`, { candidate: jsonText });
        return NextResponse.json(
          { error: "AI returned an unparseable response. Please try again." },
          { status: 502 },
        );
      }

      if (!Array.isArray(parsed.specs)) {
        return NextResponse.json(
          { error: "AI response did not contain a specs list. Please try again." },
          { status: 502 },
        );
      }

      const merged = mergeSpecs(item.specs, parsed.specs);

      await query(
        `UPDATE ${c.table}
            SET specs = $1, specs_updated_at = NOW()${c.patchSetUpdatedAt ? ", updated_at = NOW()" : ""}
          WHERE id = $2 AND user_id = $3`,
        [JSON.stringify(merged), id, session.user.id],
      );

      const aiCount = merged.filter((s) => s.source === "ai").length;
      console.log(`[specs] generated ${aiCount} AI spec(s) for ${c.label} id=${id} (kept ${merged.length - aiCount} manual)`);

      return NextResponse.json({
        specs: merged,
        specs_updated_at: new Date().toISOString(),
        ai_count: aiCount,
        manual_count: merged.length - aiCount,
      });
    } catch (error) {
      console.error(`POST /api/${c.label}/[id]/specs error:`, error);
      const apiErr = error as { status?: number };
      if (apiErr?.status === 429) {
        return NextResponse.json(
          { error: "Rate limit reached. Try again in a minute.", code: "rate_limited" },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: "Failed to generate specs" }, { status: 500 });
    }
  };
}

// ── Bulk specs generation (CUR-1) ────────────────────────────────────────────
//
// Drives "Generate specs" from the list-page selection (BulkActionBar). Mirrors
// the value-batch pattern: fan out to the per-item /specs endpoint, one at a
// time with a short delay to stay under the AI rate limit, and report a
// per-item summary. Ownership is enforced by the per-item handler (each call
// filters by session user), and the forwarded cookie/Authorization header
// carries the caller's identity through to it.
//
// Body: { ids: string[] }  →  { generated, failed, items: [{ id, ai_count?, error? }] }
export function makeSpecsBatchHandler(c: CollectionConfig) {
  return async function POST(request: NextRequest) {
    try {
      const session = await getApiSession(request);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      let body: { ids?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") as string[] : null;
      if (!ids || ids.length === 0) {
        return NextResponse.json({ error: "ids must be a non-empty string[]" }, { status: 400 });
      }
      // Each id triggers a web_search-backed AI call; cap the fan-out so a
      // runaway selection can't queue dozens of minutes of work.
      if (ids.length > 50) {
        return NextResponse.json({ error: "Bulk specs generation is limited to 50 items per request" }, { status: 400 });
      }

      const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`;
      const cookie = request.headers.get("cookie") ?? "";
      const authz = request.headers.get("authorization") ?? "";

      const results: { id: string; ai_count?: number; error?: string }[] = [];
      for (const id of ids) {
        try {
          const res = await fetch(`${baseUrl}/api/${c.moduleSlug}/${id}/specs`, {
            method: "POST",
            headers: { cookie, ...(authz ? { authorization: authz } : {}) },
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({} as { error?: string }));
            results.push({ id, error: err.error || "Specs generation failed" });
          } else {
            const data = (await res.json()) as { ai_count?: number };
            results.push({ id, ai_count: data.ai_count });
          }
        } catch (err) {
          results.push({ id, error: String(err) });
        }
        await sleep(500);
      }

      const generated = results.filter((r) => !r.error).length;
      const failed = results.filter((r) => r.error).length;
      return NextResponse.json({ generated, failed, items: results });
    } catch (error) {
      console.error(`POST /api/${c.label}/specs-batch error:`, error);
      return NextResponse.json({ error: "Batch specs generation failed" }, { status: 500 });
    }
  };
}
