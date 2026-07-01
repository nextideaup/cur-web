// eBay OAuth (authorization-code grant) — the "Connect eBay" flow that lets a
// standard seller authorize Vault1 with their normal eBay login, instead of
// pasting a developer-portal token they can't get.
//
// Flow:
//   1. /api/marketplace/ebay/connect  → redirect the seller to eBay's consent
//      page (buildAuthorizeUrl).
//   2. eBay redirects back to /api/marketplace/ebay/callback with ?code=…
//      → exchangeCodeForTokens → store encrypted access + refresh tokens.
//   3. At listing time the access token is refreshed on demand
//      (refreshAccessToken) using the stored refresh token.
//
// eBay quirk: the `redirect_uri` parameter in both the authorize URL and the
// token exchange is the **RuName** (the eBay "Redirect URL name"), NOT the raw
// https callback URL. eBay maps the RuName to the callback you registered.

// sell.inventory → create offers + read inventory locations.
// sell.account.readonly → read the seller's business policies (fulfillment /
// payment / return) so we can auto-fill them instead of hand-typing IDs.
// NOTE: adding a scope means existing connections must reconnect to grant it.
const SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
];

export function ebaySandbox(): boolean {
  return process.env.EBAY_SANDBOX === "true" || process.env.EBAY_SANDBOX === "1";
}

export function ebayOAuthConfigured(): boolean {
  return !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET && process.env.EBAY_RUNAME);
}

function oauthHost(): string {
  return ebaySandbox() ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com";
}
function apiHost(): string {
  return ebaySandbox() ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

function basicAuthHeader(): string {
  const raw = `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`;
  return "Basic " + Buffer.from(raw).toString("base64");
}

export function buildAuthorizeUrl(state: string): string {
  const u = new URL(`${oauthHost()}/oauth2/authorize`);
  u.searchParams.set("client_id", process.env.EBAY_CLIENT_ID!);
  u.searchParams.set("redirect_uri", process.env.EBAY_RUNAME!); // RuName, not the URL
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES.join(" "));
  u.searchParams.set("state", state);
  return u.toString();
}

export interface EbayTokenResponse {
  access_token: string;
  expires_in: number; // seconds
  refresh_token?: string;
  refresh_token_expires_in?: number;
  token_type: string;
}

async function tokenRequest(body: URLSearchParams): Promise<EbayTokenResponse> {
  const res = await fetch(`${apiHost()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { error_description?: string; error?: string };
      msg = j.error_description || j.error || msg;
    } catch { /* non-JSON */ }
    throw new Error(`eBay token endpoint failed (HTTP ${res.status}): ${msg}`);
  }
  return JSON.parse(text) as EbayTokenResponse;
}

export function exchangeCodeForTokens(code: string): Promise<EbayTokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.EBAY_RUNAME!, // RuName again
    }),
  );
}

export function refreshAccessToken(refreshToken: string): Promise<EbayTokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: SCOPES.join(" "),
    }),
  );
}

// ── Application token (client-credentials) + Taxonomy ─────────────────────────
//
// The Taxonomy API (category suggestions) is app-level data, not user-specific,
// so we use an APPLICATION access token (client_credentials grant) rather than
// burdening the seller's consent with a taxonomy scope. Cached on globalThis
// until shortly before expiry.

const APP_SCOPE = "https://api.ebay.com/oauth/api_scope";
const g = globalThis as unknown as {
  __ebayAppToken?: { token: string; expiresAt: number; sandbox: boolean };
  __ebayCategoryTree?: Record<string, string>; // marketplaceId → categoryTreeId
};

async function getApplicationToken(): Promise<string> {
  const sandbox = ebaySandbox();
  const cached = g.__ebayAppToken;
  if (cached && cached.sandbox === sandbox && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }
  const resp = await tokenRequest(
    new URLSearchParams({ grant_type: "client_credentials", scope: APP_SCOPE }),
  );
  g.__ebayAppToken = {
    token: resp.access_token,
    expiresAt: Date.now() + resp.expires_in * 1000,
    sandbox,
  };
  return resp.access_token;
}

async function categoryTreeId(marketplaceId: string, appToken: string): Promise<string> {
  g.__ebayCategoryTree ??= {};
  if (g.__ebayCategoryTree[marketplaceId]) return g.__ebayCategoryTree[marketplaceId];
  const res = await fetch(
    `${apiHost()}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${encodeURIComponent(marketplaceId)}`,
    { headers: { Authorization: `Bearer ${appToken}` } },
  );
  if (!res.ok) throw new Error(`eBay taxonomy tree lookup failed (HTTP ${res.status})`);
  const data = (await res.json()) as { categoryTreeId?: string };
  if (!data.categoryTreeId) throw new Error("eBay taxonomy returned no categoryTreeId");
  g.__ebayCategoryTree[marketplaceId] = data.categoryTreeId;
  return data.categoryTreeId;
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
}

// Best-effort leaf-category suggestion for a listing title. Returns null on any
// failure so the caller can fall back to a manual categoryId.
export async function getCategorySuggestion(
  title: string,
  marketplaceId = "EBAY_US",
): Promise<CategorySuggestion | null> {
  try {
    const appToken = await getApplicationToken();
    const treeId = await categoryTreeId(marketplaceId, appToken);
    const res = await fetch(
      `${apiHost()}/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions?q=${encodeURIComponent(title)}`,
      { headers: { Authorization: `Bearer ${appToken}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      categorySuggestions?: { category?: { categoryId?: string; categoryName?: string } }[];
    };
    const top = data.categorySuggestions?.[0]?.category;
    if (top?.categoryId) {
      return { categoryId: top.categoryId, categoryName: top.categoryName ?? top.categoryId };
    }
    return null;
  } catch (e) {
    console.warn("[ebay] category suggestion failed:", e);
    return null;
  }
}
