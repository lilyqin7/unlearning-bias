import { comparisonFromB64Payload } from "./b64-response";
import type { ComparisonRequest, ComparisonResponse } from "./types";

/** Same JSON body as SageMaker / `self-hosted-inference/server.py`. */
type InferencePayload = {
  baseline_prompt: string;
  diverse_prompt: string;
  num_inference_steps: number;
  guidance_scale: number;
  seed: number;
  lora_scale: number;
  lora_weights_url: string;
};

type InferenceJson = {
  baseline_image_b64: string;
  diverse_image_b64: string;
  mime_type?: string;
};

/**
 * Call a self-hosted HTTP API (Google Colab + ngrok, local GPU + localhost, etc.).
 * Set INFERENCE_API_URL to the origin only, e.g. https://abc123.ngrok-free.app
 * The client POSTs to `${INFERENCE_API_URL}/generate`.
 */
export async function generateWithSelfHosted(req: ComparisonRequest): Promise<ComparisonResponse> {
  const base = process.env.INFERENCE_API_URL?.trim();
  if (!base) {
    throw new Error("Missing INFERENCE_API_URL (origin of your Colab/local FastAPI server)");
  }

  const url = `${base.replace(/\/$/, "")}/generate`;
  const payload: InferencePayload = {
    baseline_prompt: req.baselinePrompt,
    diverse_prompt: req.diversePrompt,
    num_inference_steps: req.numInferenceSteps,
    guidance_scale: req.guidanceScale,
    seed: req.seed,
    lora_scale: req.loraScale,
    lora_weights_url: req.loraWeightsUrl,
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.INFERENCE_API_NGROK_SKIP_BROWSER_WARNING === "1") {
    headers["ngrok-skip-browser-warning"] = "true";
  }

  const started = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Self-hosted inference failed (${res.status}): ${text.slice(0, 500)}`);
  }

  let json: InferenceJson;
  try {
    json = JSON.parse(text) as InferenceJson;
  } catch {
    throw new Error(`Self-hosted server returned non-JSON (first 200 chars): ${text.slice(0, 200)}`);
  }

  return comparisonFromB64Payload(json, req, Date.now() - started);
}
