-- 021_marketplace_oauth.sql
-- eBay "Connect eBay" OAuth flow (CUR-1). The authorization-code grant yields a
-- short-lived access token (~2h) plus a long-lived refresh token (~18 months).
-- We store the refresh token encrypted alongside the (also encrypted) access
-- token in marketplace_credentials, and remember when the access token expires
-- so the listing path can refresh it transparently.
--
--   token_encrypted          — the current ACCESS token (already existed;
--                              reused for both paste-token and OAuth channels).
--   refresh_token_encrypted  — the OAuth refresh token (NULL for paste-token
--                              credentials like a Reverb personal token).
--   token_expires_at         — when token_encrypted stops working; NULL means
--                              "never refresh" (paste-token path).

ALTER TABLE marketplace_credentials
  ADD COLUMN refresh_token_encrypted TEXT,
  ADD COLUMN token_expires_at TIMESTAMPTZ;
