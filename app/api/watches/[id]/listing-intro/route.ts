import { makeListingIntroHandler } from "@/lib/listing-intro-handler";
import { watchConfig } from "@/lib/collections/watch";
import type { WatchItem } from "@/lib/types";

export const POST = makeListingIntroHandler<WatchItem>(watchConfig);
