// Standard listing footer (boilerplate terms). Effective footer for a draft is
// resolved item-override → user-default → this built-in.

export const DEFAULT_LISTING_FOOTER =
  "Only items explicitly stated in this listing are included. Everything is packed well — protected and padded — for safe transit. Quick shipping within 2 business days of funds clearing. Ships to the Continental US only.";

export function resolveFooter(itemFooter?: string | null, userDefault?: string | null): string {
  return itemFooter?.trim() || userDefault?.trim() || DEFAULT_LISTING_FOOTER;
}
