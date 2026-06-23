import { makeListingHandler } from "@/lib/listings/handler";
import { guitarConfig } from "@/lib/collections/guitar";

export const { POST, GET } = makeListingHandler(guitarConfig);
