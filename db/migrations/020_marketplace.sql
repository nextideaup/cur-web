-- 020_marketplace.sql
-- Marketplace listing integration (CUR-1 flip/sell). Two tables:
--
-- marketplace_credentials — per-user, per-channel auth. v1 stores a personal
--   access token (Reverb) or a user OAuth token (eBay), encrypted at rest by
--   lib/listings/crypto.ts (AES-256-GCM). `meta` carries non-secret channel
--   config (eBay marketplace id, merchant location key, policy ids, sandbox
--   flag, etc.). One row per (user, channel).
--
-- marketplace_listings — a record of every listing we've created on a channel
--   for one of the four collection item types. Polymorphic: (module, item_id)
--   points at guitar_items / watch_items / automobiles / items_of_distinction.
--   No FK (cross-table), so deletes are handled in app code. `state` tracks the
--   draft→published lifecycle; `external_id` / `external_url` link back to the
--   marketplace; `payload` keeps the request we sent for debugging.

CREATE TABLE marketplace_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('reverb', 'ebay')),
  token_encrypted TEXT NOT NULL,
  label           TEXT,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, channel)
);

CREATE INDEX idx_marketplace_credentials_user ON marketplace_credentials (user_id);

CREATE TABLE marketplace_listings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL CHECK (channel IN ('reverb', 'ebay')),
  module       TEXT NOT NULL CHECK (module IN ('guitars', 'watches', 'automobiles', 'iod')),
  item_id      UUID NOT NULL,
  external_id  TEXT,
  external_url TEXT,
  state        TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published', 'ended', 'error')),
  error        TEXT,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_marketplace_listings_item ON marketplace_listings (user_id, module, item_id);
CREATE INDEX idx_marketplace_listings_channel ON marketplace_listings (user_id, channel);
