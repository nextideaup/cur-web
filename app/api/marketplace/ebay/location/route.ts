// POST /api/marketplace/ebay/location
// Creates a default eBay inventory location for the seller. eBay requires a
// merchantLocationKey to draft an offer but offers no self-serve UI to make one
// (it's Inventory-API-only), so this backs the in-app "Create location" form.

import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { resolveEbayAccessToken, createEbayLocation } from "@/lib/listings/ebay-account";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: string;
    addressLine1?: string;
    city?: string;
    stateOrProvince?: string;
    postalCode?: string;
    country?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const postalCode = body.postalCode?.trim();
  const country = body.country?.trim().toUpperCase();
  const name = body.name?.trim() || "Default";
  if (!postalCode || !country || country.length !== 2) {
    return NextResponse.json({ error: "postalCode and a 2-letter country are required." }, { status: 400 });
  }

  const { token, error } = await resolveEbayAccessToken(session.user.id);
  if (error || !token) {
    return NextResponse.json(
      { error: "Reconnect eBay in Marketplace settings.", code: error ?? "reauth" },
      { status: 400 },
    );
  }

  // Seller-chosen key (≤36 chars). Timestamp keeps it unique if they make more.
  const merchantLocationKey = `vault1-${Date.now().toString(36)}`;

  try {
    await createEbayLocation(token, merchantLocationKey, {
      name,
      addressLine1: body.addressLine1?.trim() || undefined,
      city: body.city?.trim() || undefined,
      stateOrProvince: body.stateOrProvince?.trim() || undefined,
      postalCode,
      country,
    });
    return NextResponse.json({ merchantLocationKey, name });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[ebay] create location failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
