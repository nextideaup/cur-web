-- 022_listing_intro.sql
-- A seller-facing "listing intro" — an AI-generated (and user-editable) opening
-- paragraph for a marketplace listing, stored per item and reused for both the
-- Reverb and eBay drafts. Generated from the item's details + notes + any
-- special details the seller confirms at generation time. NULL until created.

ALTER TABLE guitar_items         ADD COLUMN listing_intro TEXT;
ALTER TABLE watch_items          ADD COLUMN listing_intro TEXT;
ALTER TABLE automobiles          ADD COLUMN listing_intro TEXT;
ALTER TABLE items_of_distinction ADD COLUMN listing_intro TEXT;
