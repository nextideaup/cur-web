import { makeSpecsBatchHandler } from "@/lib/specs-handler";
import { watchConfig } from "@/lib/collections/watch";

export const POST = makeSpecsBatchHandler(watchConfig);
