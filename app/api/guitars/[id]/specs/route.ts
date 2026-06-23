import { makeSpecsHandler } from "@/lib/specs-handler";
import { guitarConfig } from "@/lib/collections/guitar";
import { guitarSpecsPrompt } from "@/lib/collections/guitar-specs-prompt";
import type { GuitarItem } from "@/lib/types";

export const POST = makeSpecsHandler<GuitarItem>(guitarConfig, guitarSpecsPrompt);
