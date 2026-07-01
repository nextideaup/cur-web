// GET /api/marketplace/ebay/connect
// Kicks off the eBay OAuth flow: sets a short-lived CSRF `state` cookie and
// redirects the signed-in user to eBay's consent page. eBay returns them to
// /api/marketplace/ebay/callback. Requires a Vault1 session (the browser
// carries the session cookie, so the callback knows which user connected).

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getApiSession } from "@/lib/api-auth";
import { buildAuthorizeUrl, ebayOAuthConfigured } from "@/lib/listings/ebay-oauth";

export const dynamic = "force-dynamic";

function appBaseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

export async function GET(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session?.user?.id) {
    // Bounce through login, then back here.
    const login = new URL("/login", appBaseUrl());
    login.searchParams.set("callbackUrl", "/api/marketplace/ebay/connect");
    return NextResponse.redirect(login);
  }

  if (!ebayOAuthConfigured()) {
    return NextResponse.redirect(`${appBaseUrl()}/?ebay=not_configured`);
  }

  const state = crypto.randomBytes(24).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set("ebay_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // sent on the top-level GET redirect back from eBay
    path: "/",
    maxAge: 600, // 10 minutes to complete consent
  });
  return res;
}
