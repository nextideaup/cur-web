-- 025_listing_price.sql
-- Per-item "Sell Price" for marketplace listings. Defaults (in the UI) to the
-- user-set value, falling back to the latest AI valuation; the seller can
-- override it here. Used as the offer/listing price when drafting on Reverb/eBay
-- (see lib/listings/handler.ts assembleListing). NULL = fall back to the
-- computed default at post time.

ALTER TABLE guitar_items        ADD COLUMN listing_price NUMERIC;
ALTER TABLE watch_items         ADD COLUMN listing_price NUMERIC;
ALTER TABLE automobiles         ADD COLUMN listing_price NUMERIC;
ALTER TABLE items_of_distinction ADD COLUMN listing_price NUMERIC;
