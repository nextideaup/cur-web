import { makeSpecsHandler } from "@/lib/specs-handler";
import { iodConfig } from "@/lib/collections/iod";
import { iodSpecsPrompt } from "@/lib/collections/iod-specs-prompt";
import type { IoDItem } from "@/lib/types";

export const POST = makeSpecsHandler<IoDItem>(iodConfig, iodSpecsPrompt);
