import { makeListingHandler } from "@/lib/listings/handler";
import { autoConfig } from "@/lib/collections/auto";

export const { POST, GET } = makeListingHandler(autoConfig);
