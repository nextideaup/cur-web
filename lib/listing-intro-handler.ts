// AI "listing intro" generator — writes a natural opening paragraph for a
// marketplace listing from the item's details + specs + notes + any special
// details the seller adds. Unlike valuation/specs it needs no web search (it's
// copywriting over data we already have), so it's a plain Claude completion.
// The result is persisted to <table>.listing_intro and reused for both the
// Reverb and eBay drafts.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getApiSession } from "@/lib/api-auth";
import { query, queryOne } from "@/lib/db";
import type { CollectionConfig } from "@/lib/collections/types";
import type { SpecEntry } from "@/lib/types";

const client = new Anthropic();

interface IntroItem {
  id: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  condition?: string | null;
  color_finish?: string | null;
  trim_level?: string | null;
  item_type?: string | null;
  short_description?: string | null;
  notes?: string | null;
  specs?: SpecEntry[] | null;
}

function buildIntroPrompt(item: IntroItem, conditionOverride?: string, details?: string): string {
  const descriptor =
    [item.year, item.brand, item.model, item.trim_level, item.color_finish].filter(Boolean).join(" ") ||
    item.short_description?.trim() ||
    item.item_type?.trim() ||
    "this item";
  const condition = (conditionOverride || item.condition || "").toString().trim();
  const specs = (item.specs ?? [])
    .filter((s) => s?.label?.trim() && s?.value?.trim())
    .slice(0, 12)
    .map((s) => `${s.label.trim()}: ${s.value.trim()}`)
    .join("; ");
  const notes = item.notes?.trim();
  const extra = details?.trim();

  return `You are the seller, writing the opening paragraph of a resale listing.

Item: ${descriptor}
${condition ? `Condition: ${condition}\n` : ""}${specs ? `Notable specs: ${specs}\n` : ""}${notes ? `Seller's notes: ${notes}\n` : ""}${extra ? `Extra details from the seller: ${extra}\n` : ""}
Write a natural, honest, appealing opening paragraph (2–4 sentences) that makes a buyer want this piece. Lead with what makes it desirable, state the condition plainly, and weave in the most sell-relevant details from the notes (upgrades, provenance, standout features). Do NOT invent anything not stated above. No markdown, no bullet points, no greeting or sign-off — return only the paragraph text.`;
}

export function makeListingIntroHandler<T extends IntroItem>(c: CollectionConfig) {
  return async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
      const session = await getApiSession(request);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { id } = await params;

      let body: { condition?: string; details?: string } = {};
      try {
        body = (await request.json()) as typeof body;
      } catch { /* body is optional */ }

      const item = await queryOne<T>(
        `SELECT * FROM ${c.table} WHERE id = $1 AND user_id = $2`,
        [id, session.user.id],
      );
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

      const prompt = buildIntroPrompt(item, body.condition, body.details);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = (await (client.messages.create as any)({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      })) as { content: { type: string; text?: string }[] };

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join(" ")
        .trim()
        // Strip any wrapping quotes the model may add around the paragraph.
        .replace(/^["'“]+|["'”]+$/g, "")
        .trim();

      if (!text) {
        return NextResponse.json({ error: "The AI returned an empty intro. Please try again." }, { status: 502 });
      }

      await query(
        `UPDATE ${c.table}
            SET listing_intro = $1${c.patchSetUpdatedAt ? ", updated_at = NOW()" : ""}
          WHERE id = $2 AND user_id = $3`,
        [text, id, session.user.id],
      );

      return NextResponse.json({ listing_intro: text });
    } catch (error) {
      const apiErr = error as { status?: number };
      if (apiErr?.status === 429) {
        return NextResponse.json({ error: "Rate limit reached. Try again in a minute.", code: "rate_limited" }, { status: 429 });
      }
      console.error(`POST /api/${c.label}/[id]/listing-intro error:`, error);
      return NextResponse.json({ error: "Failed to generate listing intro" }, { status: 500 });
    }
  };
}
