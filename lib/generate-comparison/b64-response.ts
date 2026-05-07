import type { ComparisonRequest, ComparisonResponse } from "./types";

type B64Payload = {
  baseline_image_b64: string;
  diverse_image_b64: string;
  mime_type?: string;
};

export function comparisonFromB64Payload(
  json: B64Payload,
  req: Pick<ComparisonRequest, "seed" | "diversePrompt">,
  durationMs: number,
): ComparisonResponse {
  if (!json.baseline_image_b64 || !json.diverse_image_b64) {
    throw new Error("Response JSON missing baseline_image_b64 or diverse_image_b64");
  }
  const mime = json.mime_type ?? "image/png";
  return {
    baselineUrl: `data:${mime};base64,${json.baseline_image_b64}`,
    diverseUrl: `data:${mime};base64,${json.diverse_image_b64}`,
    seed: req.seed,
    durationMs,
    diversePrompt: req.diversePrompt,
  };
}
