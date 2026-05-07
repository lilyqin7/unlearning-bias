export type GenerateParams = {
  baselinePrompt: string;
  diversePrompt: string;
  numInferenceSteps: number;
  guidanceScale: number;
  seed: number;
  loraScale: number;
  loraWeightsUrl: string;
};

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Baseline SDXL — no LoRA (Replicate hosts the base). */
export function buildBaselineInput(p: Pick<GenerateParams, "baselinePrompt" | "numInferenceSteps" | "guidanceScale" | "seed">) {
  return {
    prompt: p.baselinePrompt,
    negative_prompt: process.env.REPLICATE_NEGATIVE_PROMPT ?? "",
    width: intEnv("REPLICATE_IMAGE_WIDTH", 1024),
    height: intEnv("REPLICATE_IMAGE_HEIGHT", 1024),
    num_inference_steps: p.numInferenceSteps,
    guidance_scale: p.guidanceScale,
    seed: p.seed,
  };
}

/**
 * Debiased run: same hyperparameters + LoRA URL from Hugging Face (or any HTTPS .safetensors).
 * Field names for LoRA URL/scale default to common Replicate SDXL+LoRA wrappers; override with env if your model differs.
 */
export function buildDebiasedInput(p: GenerateParams) {
  // Default debias model (zylim0702/sdxl-lora-customize-model) expects `Lora_url` per Replicate API table (capital L).
  const loraField = process.env.REPLICATE_DEBIAS_LORA_FIELD ?? "Lora_url";
  const scaleField = process.env.REPLICATE_DEBIAS_SCALE_FIELD ?? "lora_scale";

  const base: Record<string, unknown> = {
    prompt: p.diversePrompt,
    negative_prompt: process.env.REPLICATE_NEGATIVE_PROMPT ?? "",
    width: intEnv("REPLICATE_IMAGE_WIDTH", 1024),
    height: intEnv("REPLICATE_IMAGE_HEIGHT", 1024),
    num_inference_steps: p.numInferenceSteps,
    guidance_scale: p.guidanceScale,
    seed: p.seed,
    [loraField]: p.loraWeightsUrl,
    [scaleField]: p.loraScale,
  };

  let extra: Record<string, unknown> = {};
  const raw = process.env.REPLICATE_DEBIAS_INPUT_EXTRA_JSON;
  if (raw) {
    try {
      extra = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid JSON in REPLICATE_DEBIAS_INPUT_EXTRA_JSON");
    }
  }

  return { ...extra, ...base };
}
