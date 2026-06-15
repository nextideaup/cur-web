import { makeSpecsBatchHandler } from "@/lib/specs-handler";
import { autoConfig } from "@/lib/collections/auto";

export const POST = makeSpecsBatchHandler(autoConfig);
