import { makeListingIntroHandler } from "@/lib/listing-intro-handler";
import { iodConfig } from "@/lib/collections/iod";
import type { IoDItem } from "@/lib/types";

export const POST = makeListingIntroHandler<IoDItem>(iodConfig);
