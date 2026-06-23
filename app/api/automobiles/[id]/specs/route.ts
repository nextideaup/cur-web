import { makeSpecsHandler } from "@/lib/specs-handler";
import { autoConfig } from "@/lib/collections/auto";
import { autoSpecsPrompt } from "@/lib/collections/auto-specs-prompt";
import type { AutoItem } from "@/lib/types";

export const POST = makeSpecsHandler<AutoItem>(autoConfig, autoSpecsPrompt);
