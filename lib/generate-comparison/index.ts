import type { ComparisonRequest, ComparisonResponse } from "./types";
import { generateWithReplicate } from "./replicate";
import { generateWithSageMaker } from "./sagemaker";
import { generateWithSelfHosted } from "./self-hosted";

export type BackendMode = "replicate" | "sagemaker" | "self";

/**
 * Resolve which backend to use.
 * - Explicit `IMAGE_GENERATION_BACKEND` always wins.
 * - Otherwise Colab-first: if `INFERENCE_API_URL` is set, use self-hosted **before** SageMaker
 *   so a leftover `SAGEMAKER_ENDPOINT_NAME` does not silently override your Colab tunnel.
 */
export function resolveBackendMode(): BackendMode {
  const explicit = process.env.IMAGE_GENERATION_BACKEND?.toLowerCase();
  if (explicit === "replicate") return "replicate";
  if (explicit === "sagemaker") return "sagemaker";
  if (explicit === "self" || explicit === "http" || explicit === "colab") return "self";
  if (process.env.INFERENCE_API_URL?.trim()) return "self";
  if (process.env.SAGEMAKER_ENDPOINT_NAME?.trim()) return "sagemaker";
  return "replicate";
}

export async function generateComparison(req: ComparisonRequest): Promise<ComparisonResponse> {
  const mode = resolveBackendMode();
  if (mode === "replicate") {
    return generateWithReplicate(req);
  }
  if (mode === "sagemaker") {
    return generateWithSageMaker(req);
  }
  return generateWithSelfHosted(req);
}

export type { ComparisonRequest, ComparisonResponse } from "./types";
