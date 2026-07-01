import { makePublishHandler } from "@/lib/listings/handler";
import { guitarConfig } from "@/lib/collections/guitar";

export const POST = makePublishHandler(guitarConfig);
