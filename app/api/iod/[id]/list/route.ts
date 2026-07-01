import { makeListingHandler } from "@/lib/listings/handler";
import { iodConfig } from "@/lib/collections/iod";

export const { POST, GET, DELETE } = makeListingHandler(iodConfig);
