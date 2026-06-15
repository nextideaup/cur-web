import { makeSpecsBatchHandler } from "@/lib/specs-handler";
import { guitarConfig } from "@/lib/collections/guitar";

export const POST = makeSpecsBatchHandler(guitarConfig);
