// GET /api/marketplace/ebay/callback?code=…&state=…
// eBay redirects the seller here after consent. We verify the CSRF state,
// exchange the auth code for access + refresh tokens, and store them
// (encrypted) on the user's eBay credential row. Then redirect back into the
// app. This is the "Auth accepted URL" registered under the RuName.
//
// The browser carries the Vault1 session cookie (same-site top-level GET), so
// getApiSession identifies which user is connecting.

import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/api-auth";
import { query } from "@/lib/db";
import { encryptToken } from "@/lib/listings/crypto";
import { exchangeCodeForTokens, ebaySandbox } from "@/lib/listings/ebay-oauth";

export const dynamic = "force-dynamic";

function appBaseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

function back(status: string): NextResponse {
  const res = NextResponse.redirect(`${appBaseUrl()}/?ebay=${status}`);
  // One-shot state cookie — clear it regardless of outcome.
  res.cookies.set("ebay_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session?.user?.id) {
    return NextResponse.redirect(`${appBaseUrl()}/login`);
  }

  const url = new URL(request.url);
  const err = url.searchParams.get("error");
  if (err) {
    console.warn(`[ebay-oauth] consent denied/error: ${err}`);
    return back("denied");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("ebay_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return back("state_error");
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const accessEnc = encryptToken(tokens.access_token);
    const refreshEnc = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Preserve any account config the user already entered in `meta`
    // (categoryId / policies / location); force `sandbox` to match the env the
    // token was minted against.
    await query(
      `INSERT INTO marketplace_credentials
         (user_id, channel, token_encrypted, refresh_token_encrypted, token_expires_at, meta, updated_at)
       VALUES ($1, 'ebay', $2, $3, $4, jsonb_build_object('sandbox', $5::boolean), NOW())
       ON CONFLICT (user_id, channel) DO UPDATE SET
         token_encrypted = EXCLUDED.token_encrypted,
         refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
         token_expires_at = EXCLUDED.token_expires_at,
         meta = COALESCE(marketplace_credentials.meta, '{}'::jsonb) || jsonb_build_object('sandbox', $5::boolean),
         updated_at = NOW()`,
      [session.user.id, accessEnc, refreshEnc, expiresAt, ebaySandbox()],
    );

    return back("connected");
  } catch (e) {
    console.error("[ebay-oauth] token exchange failed:", e);
    return back("exchange_failed");
  }
}
