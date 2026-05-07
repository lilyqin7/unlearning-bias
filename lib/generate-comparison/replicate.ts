import Replicate from "replicate";
import { buildBaselineInput, buildDebiasedInput } from "@/lib/build-sdxl-inputs";
import { firstOutputUrl } from "@/lib/replicate-output";
import type { ComparisonRequest, ComparisonResponse } from "./types";

type ModelId = `${string}/${string}` | `${string}/${string}:${string}`;

export async function generateWithReplicate(req: ComparisonRequest): Promise<ComparisonResponse> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("Missing REPLICATE_API_TOKEN");
  }

  const baselineModel = (process.env.REPLICATE_BASELINE_MODEL ??
    "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b") as ModelId;
  const debiasModel = (process.env.REPLICATE_DEBIAS_MODEL ??
    "zylim0702/sdxl-lora-customize-model:5a2b1cff79a2cf60d2a498b424795a90e26b7a3992fbd13b340f73ff4942b81e") as ModelId;

  const replicate = new Replicate({ auth: token });
  const started = Date.now();

  const baselineInput = buildBaselineInput(req);
  const debiasedInput = buildDebiasedInput(req);

  // Two parallel `run` calls hit Replicate rate limits (429) for many accounts; run one after the other by default.
  const parallel =
    process.env.REPLICATE_PARALLEL_PREDICTIONS?.trim().toLowerCase() === "1" ||
    process.env.REPLICATE_PARALLEL_PREDICTIONS?.trim().toLowerCase() === "true";

  let baselineOut: unknown;
  let diverseOut: unknown;
  if (parallel) {
    [baselineOut, diverseOut] = await Promise.all([
      replicate.run(baselineModel, { input: baselineInput }),
      replicate.run(debiasModel, { input: debiasedInput }),
    ]);
  } else {
    baselineOut = await replicate.run(baselineModel, { input: baselineInput });
    diverseOut = await replicate.run(debiasModel, { input: debiasedInput });
  }

  return {
    baselineUrl: firstOutputUrl(baselineOut),
    diverseUrl: firstOutputUrl(diverseOut),
    seed: req.seed,
    durationMs: Date.now() - started,
    diversePrompt: req.diversePrompt,
  };
}
