import { makePublishHandler } from "@/lib/listings/handler";
import { autoConfig } from "@/lib/collections/auto";

export const POST = makePublishHandler(autoConfig);
