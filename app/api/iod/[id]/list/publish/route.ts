import { makePublishHandler } from "@/lib/listings/handler";
import { iodConfig } from "@/lib/collections/iod";

export const POST = makePublishHandler(iodConfig);
