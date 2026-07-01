import { makeListingIntroHandler } from "@/lib/listing-intro-handler";
import { guitarConfig } from "@/lib/collections/guitar";
import type { GuitarItem } from "@/lib/types";

export const POST = makeListingIntroHandler<GuitarItem>(guitarConfig);
