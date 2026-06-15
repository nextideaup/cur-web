// Shared AI-valuation route factory for the four collection modules. The
// per-module prompt is the only thing that genuinely differs; the surrounding
// logic — auth, item lookup, Anthropic call with retry, JSON extraction,
// INSERT into <module>_valuations — is identical across guitars, watches,
// automobiles, and items of distinction.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getApiSession } from "@/lib/api-auth";
import { query, queryOne } from "@/lib/db";
import type { CollectionConfig } from "@/lib/collections/types";
import type { ComparableSale, InsuranceValueSource } from "@/lib/types";
import { getOrResearchNorm, computeInsuranceValue } from "@/lib/insurance-valuation";
import { extractJSON } from "@/lib/ai/extract-json";

const client = new Anthropic();

interface ValuationResult {
  suggested_price: number;
  price_low: number;
  price_high: number;
  comparable_sales: ComparableSale[];
  analysis: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface AnthropicResponse {
  content: { type: string; text: string }[];
  // Surface fields exposed by the Messages API. Typed loose because the
  // SDK's exported types are big; we only need these for debug logging
  // when extractJSON misses.
  stop_reason?: string | null;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
}

async function callWithRetry(prompt: string, maxRetries = 3): Promise<AnthropicResponse> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (client.messages.create as any)({
        // Haiku gives the same answer quality on this task as Sonnet at ~1/5
        // the per-token cost. Two web_search invocations are plenty: STEP 1
        // (sold) and an optional STEP 2 (active for-sale). max_tokens covers
        // 3-5 comparables + a 1-2 sentence analysis with headroom.
        model: "claude-haiku-4-5",
        // 8192 (was 4096, originally 1500). The web_search tool turns burn
        // a surprising amount of budget — the model reads + reasons over
        // verbose search results before it ever gets to write the final
        // JSON. If it hits the cap mid-tool-use it emits no text block at
        // all, and extractJSON 502s the request. 8192 is Haiku 4.5's
        // standard ceiling and gives generous headroom over the ~1.5k
        // tokens a populated comparable_sales[] actually needs. Output
        // tokens are billed by real length, not the cap, so this is free
        // on success-case runs.
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
      const apiErr = err as { status?: number; headers?: Record<string, string>; message?: string };
      if (apiErr?.status === 429 && attempt < maxRetries) {
        const retryAfter = parseInt(apiErr.headers?.["retry-after"] ?? "60", 10);
        console.log(`Rate limited. Waiting ${retryAfter}s before retry ${attempt + 1}/${maxRetries}...`);
        await sleep(retryAfter * 1000);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

// Item shape the handler needs to read for insurance auto-trigger (CUR-5).
// Each module's actual item type is a superset of these fields — TypeScript's
// structural typing means callers pass GuitarItem/WatchItem/etc. and it just
// works.
interface ValuableItem {
  id: string;
  category: string;
  insure?: boolean;
  purchase_price?: number | null;
  insurance_value_source?: InsuranceValueSource | null;
}

export function makeValuationHandler<T extends ValuableItem>(
  c: CollectionConfig,
  buildPrompt: (item: T) => string,
) {
  // Next 15: params is now a Promise; await before reading.
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

      // Count the block types so we can tell "model emitted text we
      // couldn't parse" apart from "model emitted no text block at all"
      // (the latter means it ran out of budget mid-tool-use).
      const textBlocks = response.content.filter((b) => b.type === "text");
      const blockTypes = response.content.map((b) => b.type);
      const allText = textBlocks.map((b) => b.text).join("\n");

      const jsonText = extractJSON(allText);
      if (!jsonText) {
        // Log everything we need to debug a Haiku 502 from Railway logs:
        // the stop reason (`max_tokens` would indicate truncation), token
        // usage, the response's block-type sequence, and the full
        // response text — NOT a slice, since the issue is almost always
        // at the END where citations or post-JSON commentary trip the
        // extractor.
        const diag = {
          model: response.model,
          stop_reason: response.stop_reason,
          usage: response.usage,
          block_types: blockTypes,
          text_block_count: textBlocks.length,
          content_length: allText.length,
        };
        console.error(
          `[valuation] No parseable JSON in AI response for ${c.label} id=${id}`,
          { ...diag, content: allText },
        );
        // Surface the diagnostic in the *user-facing* error body too. For
        // a beta this is the fastest debug loop — the failure screenshot
        // names the exact failure mode (truncation vs. no-text-block vs.
        // genuinely-unparseable) without needing Railway log access. The
        // iOS client renders the `error` string verbatim.
        const reason =
          textBlocks.length === 0
            ? `model produced no text block (stop_reason: ${diag.stop_reason ?? "unknown"}) — likely ran out of token budget during web search`
            : `model returned ${diag.content_length} chars with no parseable JSON (stop_reason: ${diag.stop_reason ?? "unknown"})`;
        return NextResponse.json(
          { error: `AI valuation failed: ${reason}. This has been logged.`, debug: diag },
          { status: 502 },
        );
      }

      let parsed: ValuationResult;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        console.error(
          `[valuation] Failed to parse extracted JSON for ${c.label} id=${id}`,
          {
            model: response.model,
            stop_reason: response.stop_reason,
            usage: response.usage,
            candidate_length: jsonText.length,
            candidate: jsonText,
          },
        );
        return NextResponse.json(
          { error: "AI returned an unparseable response. Please try again." },
          { status: 502 },
        );
      }

      const valuation = await queryOne(
        `INSERT INTO ${c.valuationsTable} (${c.valuationFkColumn}, valuation_type, price, notes, comparable_sales)
         VALUES ($1, 'ai', $2, $3, $4)
         RETURNING *`,
        [
          id,
          parsed.suggested_price,
          parsed.analysis,
          JSON.stringify(parsed.comparable_sales),
        ],
      );

      // ── Auto-trigger insurance valuation (CUR-5) ──────────────────────────
      //
      // When the item has insure=true AND the user hasn't manually set an
      // override, compute the insurance value from the fresh AI sale price
      // and the per-category multiplier. Best-effort: failures are logged
      // but never block the parent valuation response (matches the PRD's
      // stale-norm / degraded-mode requirement).

      let insuranceFields: {
        insurance_value: number | null;
        insurance_value_source: InsuranceValueSource | null;
        insurance_value_date: string | null;
      } = {
        insurance_value: null,
        insurance_value_source: null,
        insurance_value_date: null,
      };

      if (item.insure === true && item.insurance_value_source !== "user_override") {
        try {
          const norm = await getOrResearchNorm(c.moduleSlug, item.category);
          const computed = computeInsuranceValue(
            parsed.suggested_price,
            item.purchase_price ?? null,
            norm,
          );
          if (computed.value != null && computed.source != null) {
            await query(
              `UPDATE ${c.table}
                  SET insurance_value = $1,
                      insurance_value_source = $2,
                      insurance_value_date = NOW()${c.patchSetUpdatedAt ? ", updated_at = NOW()" : ""}
                WHERE id = $3 AND user_id = $4`,
              [computed.value, computed.source, id, session.user.id],
            );
            insuranceFields = {
              insurance_value: computed.value,
              insurance_value_source: computed.source,
              insurance_value_date: computed.date,
            };
            console.log(
              `[valuation] computed insurance value for ${c.label} id=${id} value=${computed.value.toFixed(2)} source=${computed.source}`,
            );
          } else {
            console.log(`[valuation] insurance computation skipped (no norm or zero multiplier) for ${c.label} id=${id}`);
          }
        } catch (insErr) {
          // Logged but never raised. The user got their sale-price valuation;
          // they can re-run later to retry insurance.
          console.error(`[valuation] insurance auto-trigger failed for ${c.label} id=${id}`, insErr);
        }
      }

      return NextResponse.json({
        valuation,
        suggested_price: parsed.suggested_price,
        price_low: parsed.price_low,
        price_high: parsed.price_high,
        comparable_sales: parsed.comparable_sales,
        analysis: parsed.analysis,
        ...insuranceFields,
      });
    } catch (error) {
      console.error(`POST /api/${c.label}/[id]/value error:`, error);
      const apiErr = error as { status?: number };
      if (apiErr?.status === 429) {
        return NextResponse.json(
          { error: "Rate limit reached. Try again in a minute.", code: "rate_limited" },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: "Failed to get AI valuation" }, { status: 500 });
    }
  };
}

// ── Insurance value handler (manual trigger, no fresh AI call) ────────────────
//
// CUR-5 auto-triggers an insurance computation as a side-effect of running
// a fresh AI sale-price valuation. But if the user already had an AI value
// before they checked "Include in insurance schedule," there's no way to
// roll the existing sale price forward into an insurance value short of
// running the AI valuation again (which would burn tokens for no reason).
//
// This factory generates a cheap POST endpoint that:
//   1. Looks up the latest AI valuation for the item (or falls back to the
//      user's purchase price).
//   2. Fetches/researches the per-category insurance norm.
//   3. Computes insurance_value via the same pure helper as CUR-5.
//   4. UPDATEs the item row.
//
// Skips when:
//   - item.insure is false (caller error; returns 400)
//   - item.insurance_value_source is 'user_override' (don't clobber manual)
//   - No AI valuation AND no purchase_price (returns 400 with a hint)

export function makeInsuranceValueHandler<T extends ValuableItem>(c: CollectionConfig) {
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

      if (item.insure !== true) {
        return NextResponse.json(
          { error: "This item is not flagged for insurance. Tick \"Include in insurance schedule\" on the Edit modal first." },
          { status: 400 },
        );
      }

      if (item.insurance_value_source === "user_override") {
        return NextResponse.json(
          { error: "This item has a user-set insurance value. Clear it in the Edit modal before auto-computing a new one." },
          { status: 400 },
        );
      }

      // Find the latest AI sale-price valuation for this item.
      const latestAi = await queryOne<{ price: string | number }>(
        `SELECT price FROM ${c.valuationsTable}
          WHERE ${c.valuationFkColumn} = $1 AND valuation_type = 'ai'
          ORDER BY created_at DESC LIMIT 1`,
        [id],
      );
      const aiPrice = latestAi?.price != null ? Number(latestAi.price) : null;
      const userPurchasePrice = item.purchase_price != null ? Number(item.purchase_price) : null;

      if ((aiPrice == null || !isFinite(aiPrice) || aiPrice <= 0) &&
          (userPurchasePrice == null || !isFinite(userPurchasePrice) || userPurchasePrice <= 0)) {
        return NextResponse.json(
          {
            error: "No AI valuation or purchase price available. Run \"Value this item\" (or set a purchase price) before computing an insurance value.",
            code: "no_source_value",
          },
          { status: 400 },
        );
      }

      const norm = await getOrResearchNorm(c.moduleSlug, item.category);
      const computed = computeInsuranceValue(aiPrice, userPurchasePrice, norm);

      if (computed.value == null || computed.source == null) {
        return NextResponse.json(
          {
            error: "Could not compute an insurance value (insurance norm research unavailable). Please try again in a minute.",
            code: "norm_unavailable",
          },
          { status: 503 },
        );
      }

      await query(
        `UPDATE ${c.table}
            SET insurance_value = $1,
                insurance_value_source = $2,
                insurance_value_date = NOW()${c.patchSetUpdatedAt ? ", updated_at = NOW()" : ""}
          WHERE id = $3 AND user_id = $4`,
        [computed.value, computed.source, id, session.user.id],
      );

      console.log(
        `[insurance-value] manual compute for ${c.label} id=${id} value=${computed.value.toFixed(2)} source=${computed.source}`,
      );

      return NextResponse.json({
        insurance_value: computed.value,
        insurance_value_source: computed.source,
        insurance_value_date: computed.date,
      });
    } catch (error) {
      console.error(`POST /api/${c.label}/[id]/insurance-value error:`, error);
      return NextResponse.json({ error: "Failed to compute insurance value" }, { status: 500 });
    }
  };
}
