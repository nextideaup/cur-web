import { makeListingIntroHandler } from "@/lib/listing-intro-handler";
import { autoConfig } from "@/lib/collections/auto";
import type { AutoItem } from "@/lib/types";

export const POST = makeListingIntroHandler<AutoItem>(autoConfig);
