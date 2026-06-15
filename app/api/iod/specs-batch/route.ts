import { makeSpecsBatchHandler } from "@/lib/specs-handler";
import { iodConfig } from "@/lib/collections/iod";

export const POST = makeSpecsBatchHandler(iodConfig);
