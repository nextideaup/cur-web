// Named box presets (per user) — reusable package weight + dimensions so a
// seller can save a standard box once and apply it to later listings.

import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await query(
    `SELECT id, name, weight_lb, length_in, width_in, height_in
       FROM box_presets WHERE user_id = $1 ORDER BY name ASC`,
    [session.user.id],
  );
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; weight_lb?: unknown; length_in?: unknown; width_in?: unknown; height_in?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "A name is required" }, { status: 400 });

  const row = await queryOne(
    `INSERT INTO box_presets (user_id, name, weight_lb, length_in, width_in, height_in)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, weight_lb, length_in, width_in, height_in`,
    [session.user.id, name, num(body.weight_lb), num(body.length_in), num(body.width_in), num(body.height_in)],
  );
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await query(`DELETE FROM box_presets WHERE id = $1 AND user_id = $2`, [id, session.user.id]);
  return NextResponse.json({ ok: true });
}
