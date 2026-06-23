import { makeListingHandler } from "@/lib/listings/handler";
import { watchConfig } from "@/lib/collections/watch";

export const { POST, GET } = makeListingHandler(watchConfig);
