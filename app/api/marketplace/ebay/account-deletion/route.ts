// eBay Marketplace Account Deletion / Closure notification endpoint.
//
// eBay requires every production app to either subscribe to or opt out of
// these notifications before the keyset is activated. We subscribe (Vault1
// stores eBay user data — OAuth tokens + listing records — so it can't opt out).
//
// Two jobs:
//   GET  — the one-time (and periodic) VALIDATION handshake. eBay calls with
//          ?challenge_code=…; we must reply 200 + JSON { challengeResponse }
//          where challengeResponse = sha256(challengeCode + verificationToken +
//          endpoint), hex. Content-Type must be application/json.
//   POST — the actual account-deletion notification. Acknowledge with 200 and
//          purge any stored eBay data for the affected user.
//
// This route is unauthenticated (eBay calls it directly) — it's excluded from
// the NextAuth middleware matcher. Security comes from the shared verification
// token: only eBay knows it, so only eBay can produce a valid challenge hash.
//
// Env:
//   EBAY_DELETION_VERIFICATION_TOKEN — 32–80 chars [A-Za-z0-9_-]; must match
//     the token entered in the eBay developer portal.
//   EBAY_DELETION_ENDPOINT_URL — the exact HTTPS URL registered in the portal.
//     eBay hashes with that exact string, so pin it here rather than trusting
//     the inbound request host. Falls back to NEXTAUTH_URL + this path.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function endpointUrl(): string {
  if (process.env.EBAY_DELETION_ENDPOINT_URL) return process.env.EBAY_DELETION_ENDPOINT_URL;
  const base = process.env.NEXTAUTH_URL || "";
  return `${base}/api/marketplace/ebay/account-deletion`;
}

export async function GET(request: NextRequest) {
  const challengeCode = new URL(request.url).searchParams.get("challenge_code");
  if (!challengeCode) {
    return NextResponse.json({ error: "missing challenge_code" }, { status: 400 });
  }
  const token = process.env.EBAY_DELETION_VERIFICATION_TOKEN;
  if (!token) {
    console.error("[ebay-deletion] EBAY_DELETION_VERIFICATION_TOKEN is not set");
    return NextResponse.json({ error: "endpoint not configured" }, { status: 500 });
  }

  // Order is significant: challengeCode + verificationToken + endpoint.
  const hash = crypto.createHash("sha256");
  hash.update(challengeCode);
  hash.update(token);
  hash.update(endpointUrl());
  const challengeResponse = hash.digest("hex");

  return NextResponse.json({ challengeResponse }, { status: 200 });
}

export async function POST(request: NextRequest) {
  // Real deletion notification. eBay expects a prompt 2xx; do the acknowledge
  // first and treat the purge as best-effort so a slow/failed purge never makes
  // eBay retry-storm or mark the endpoint down.
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    // eBay always sends JSON, but don't fail the ack over a parse error.
  }

  try {
    const notif = (payload as { notification?: { data?: { userId?: string; username?: string } } })?.notification;
    const ebayUserId = notif?.data?.userId ?? null;
    const ebayUsername = notif?.data?.username ?? null;
    // We don't yet persist the eBay userId/username against our users (the v1
    // credential row stores only the token), so there's no key to purge on
    // here. Log the event for the compliance audit trail; once the OAuth flow
    // stores the eBay user id on marketplace_credentials.meta, delete the
    // matching credential + listing rows at this point.
    console.log(`[ebay-deletion] account deletion notification received (ebayUserId=${ebayUserId ?? "?"}, username=${ebayUsername ?? "?"})`);
  } catch (err) {
    console.error("[ebay-deletion] error handling notification (acknowledged anyway):", err);
  }

  // 200 with no body is a valid acknowledgement.
  return new NextResponse(null, { status: 200 });
}
