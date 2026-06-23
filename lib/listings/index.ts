import { reverbChannel } from "./reverb";
import { ebayChannel } from "./ebay";
import type { ListingChannel, ListingChannelSlug } from "./types";

export const CHANNELS: Record<ListingChannelSlug, ListingChannel> = {
  reverb: reverbChannel,
  ebay: ebayChannel,
};

export function getChannel(slug: string): ListingChannel | null {
  if (slug === "reverb" || slug === "ebay") return CHANNELS[slug];
  return null;
}

export const CHANNEL_SLUGS: ListingChannelSlug[] = ["reverb", "ebay"];
