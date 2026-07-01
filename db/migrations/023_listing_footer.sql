-- 023_listing_footer.sql
-- Standard "listing footer" boilerplate (shipping/packing/inclusions terms)
-- appended to every marketplace listing.
--   users.listing_footer_default — the seller's default footer (NULL = use the
--     app's built-in DEFAULT_LISTING_FOOTER).
--   <item>.listing_footer — a per-listing override (NULL = use the default).
-- Effective footer = item override → user default → built-in.

ALTER TABLE users ADD COLUMN listing_footer_default TEXT;

ALTER TABLE guitar_items         ADD COLUMN listing_footer TEXT;
ALTER TABLE watch_items          ADD COLUMN listing_footer TEXT;
ALTER TABLE automobiles          ADD COLUMN listing_footer TEXT;
ALTER TABLE items_of_distinction ADD COLUMN listing_footer TEXT;
