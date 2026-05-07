import { InvokeEndpointCommand, SageMakerRuntimeClient } from "@aws-sdk/client-sagemaker-runtime";
import { comparisonFromB64Payload } from "./b64-response";
import type { ComparisonRequest, ComparisonResponse } from "./types";

/** JSON contract expected by `sagemaker/inference/inference.py` */
type SageMakerPayload = {
  baseline_prompt: string;
  diverse_prompt: string;
  num_inference_steps: number;
  guidance_scale: number;
  seed: number;
  lora_scale: number;
  lora_weights_url: string;
};

type SageMakerModelOutput = {
  baseline_image_b64: string;
  diverse_image_b64: string;
  mime_type?: string;
};

export async function generateWithSageMaker(req: ComparisonRequest): Promise<ComparisonResponse> {
  const endpointName = process.env.SAGEMAKER_ENDPOINT_NAME;
  if (!endpointName) {
    throw new Error("Missing SAGEMAKER_ENDPOINT_NAME");
  }

  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
  if (!region) {
    throw new Error("Missing AWS_REGION (or AWS_DEFAULT_REGION) for SageMaker Runtime client");
  }

  const client = new SageMakerRuntimeClient({ region });
  const payload: SageMakerPayload = {
    baseline_prompt: req.baselinePrompt,
    diverse_prompt: req.diversePrompt,
    num_inference_steps: req.numInferenceSteps,
    guidance_scale: req.guidanceScale,
    seed: req.seed,
    lora_scale: req.loraScale,
    lora_weights_url: req.loraWeightsUrl,
  };

  const started = Date.now();
  const out = await client.send(
    new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: "application/json",
      Accept: "application/json",
      Body: new TextEncoder().encode(JSON.stringify(payload)),
    }),
  );

  if (!out.Body) {
    throw new Error("SageMaker returned an empty response body");
  }

  const text = new TextDecoder().decode(out.Body);
  let json: SageMakerModelOutput;
  try {
    json = JSON.parse(text) as SageMakerModelOutput;
  } catch {
    throw new Error(`SageMaker returned non-JSON body (first 200 chars): ${text.slice(0, 200)}`);
  }

  return comparisonFromB64Payload(json, req, Date.now() - started);
}
