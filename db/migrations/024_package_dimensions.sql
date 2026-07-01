-- 024_package_dimensions.sql
-- Per-item shipping package weight + dimensions (used to populate eBay listings;
-- eBay requires a weight to publish). Plus named box presets so standard box
-- sizes can be saved once and reused on later listings.

ALTER TABLE guitar_items
  ADD COLUMN package_weight_lb NUMERIC,
  ADD COLUMN package_length_in NUMERIC,
  ADD COLUMN package_width_in  NUMERIC,
  ADD COLUMN package_height_in NUMERIC;

ALTER TABLE watch_items
  ADD COLUMN package_weight_lb NUMERIC,
  ADD COLUMN package_length_in NUMERIC,
  ADD COLUMN package_width_in  NUMERIC,
  ADD COLUMN package_height_in NUMERIC;

ALTER TABLE automobiles
  ADD COLUMN package_weight_lb NUMERIC,
  ADD COLUMN package_length_in NUMERIC,
  ADD COLUMN package_width_in  NUMERIC,
  ADD COLUMN package_height_in NUMERIC;

ALTER TABLE items_of_distinction
  ADD COLUMN package_weight_lb NUMERIC,
  ADD COLUMN package_length_in NUMERIC,
  ADD COLUMN package_width_in  NUMERIC,
  ADD COLUMN package_height_in NUMERIC;

-- Reusable named box presets (per user).
CREATE TABLE box_presets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  weight_lb  NUMERIC,
  length_in  NUMERIC,
  width_in   NUMERIC,
  height_in  NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_box_presets_user ON box_presets (user_id);
