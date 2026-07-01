// GET /api/marketplace/ebay/account-options?marketplaceId=EBAY_US
// Returns the seller's eBay inventory locations + business policies so the
// Marketplace modal can offer dropdowns instead of hand-typed IDs, and deep-link
// to eBay when a policy type is missing.

import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { resolveEbayAccessToken, fetchEbayAccountOptions } from "@/lib/listings/ebay-account";

export const dynamic = "force-dynamic";

// Where a seller sets these up on eBay when they have none.
const SETUP_LINKS = {
  policies: "https://www.ebay.com/bp/policyoptin",
  locations: "https://www.ebay.com/sh/ovw",
};

export async function GET(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const marketplaceId = new URL(request.url).searchParams.get("marketplaceId") || "EBAY_US";

  const { token, error } = await resolveEbayAccessToken(session.user.id);
  if (error === "not_connected") {
    return NextResponse.json({ error: "Connect eBay first.", code: "not_connected" }, { status: 400 });
  }
  if (error === "reauth" || !token) {
    // Token can't be refreshed, or the connection predates a scope we now need.
    return NextResponse.json({
      needs_reauth: true,
      locations: [], fulfillmentPolicies: [], paymentPolicies: [], returnPolicies: [],
      setup_links: SETUP_LINKS,
    });
  }

  try {
    const options = await fetchEbayAccountOptions(token, marketplaceId);
    return NextResponse.json({ ...options, setup_links: SETUP_LINKS });
  } catch (e) {
    console.error("[ebay] account-options fetch failed:", e);
    return NextResponse.json({ error: "Could not load eBay account settings. Try again." }, { status: 502 });
  }
}
