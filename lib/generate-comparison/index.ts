import { generateWithSelfHosted } from "./self-hosted";
import type { ComparisonRequest, ComparisonResponse } from "./types";

export async function generateComparison(req: ComparisonRequest): Promise<ComparisonResponse> {
  return generateWithSelfHosted(req);
}

export type { ComparisonRequest, ComparisonResponse } from "./types";
