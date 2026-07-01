import { makePublishHandler } from "@/lib/listings/handler";
import { watchConfig } from "@/lib/collections/watch";

export const POST = makePublishHandler(watchConfig);
