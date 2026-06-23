import { makeSpecsHandler } from "@/lib/specs-handler";
import { watchConfig } from "@/lib/collections/watch";
import { watchSpecsPrompt } from "@/lib/collections/watch-specs-prompt";
import type { WatchItem } from "@/lib/types";

export const POST = makeSpecsHandler<WatchItem>(watchConfig, watchSpecsPrompt);
