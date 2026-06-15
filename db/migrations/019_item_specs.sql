-- 019_item_specs.sql
-- Adds a freeform "specs" section to all four collection item tables — the
-- structured detail (body wood / pickups / scale length for guitars, movement /
-- case size / lug width for watches, etc.) that a flip/sell listing needs.
--
-- `specs` is a JSONB array of objects:
--   [{ "label": text, "value": text, "source": "ai" | "manual" }, ...]
--
-- AI-generated entries (source='ai') come from the per-module specs handler
-- (web_search-backed, lib/specs-handler.ts). Manual entries (source='manual')
-- are user-entered and SURVIVE AI refreshes — re-running AI generation replaces
-- only the 'ai' rows and never clobbers a manual override. `specs_updated_at`
-- stamps the last time either path wrote the column.
--
-- Stored as a JSON array (not an object) to preserve display order and allow a
-- per-entry source tag. NULL = no specs captured yet.

ALTER TABLE guitar_items
  ADD COLUMN specs JSONB,
  ADD COLUMN specs_updated_at TIMESTAMPTZ;

ALTER TABLE watch_items
  ADD COLUMN specs JSONB,
  ADD COLUMN specs_updated_at TIMESTAMPTZ;

ALTER TABLE automobiles
  ADD COLUMN specs JSONB,
  ADD COLUMN specs_updated_at TIMESTAMPTZ;

ALTER TABLE items_of_distinction
  ADD COLUMN specs JSONB,
  ADD COLUMN specs_updated_at TIMESTAMPTZ;
