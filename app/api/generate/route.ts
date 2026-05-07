import { generateComparison, resolveBackendMode } from "@/lib/generate-comparison";
import { NextResponse } from "next/server";

export const maxDuration = 300;

type Body = {
  prompt?: string;
  loraScale?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  seed?: number;
};

function envBackendHint(): string {
  const mode = resolveBackendMode();
  if (mode === "self") {
    return "Using self-hosted GPU (INFERENCE_API_URL). See self-hosted-inference/README.md.";
  }
  if (mode === "sagemaker") {
    return "Using SageMaker. Set AWS_REGION, credentials, and SAGEMAKER_ENDPOINT_NAME.";
  }
  return "Using Replicate. Set REPLICATE_API_TOKEN + LORA_WEIGHTS_URL, or switch backend (see .env.example).";
}

/** Fallback hint when no specific rule matches — matches the backend you are actually using. */
function defaultCatchHint(): string {
  switch (resolveBackendMode()) {
    case "replicate":
      return "Replicate: confirm REPLICATE_API_TOKEN, model env pins, and a public LORA_WEIGHTS_URL (HF resolve link to .safetensors). See replicate.com prediction logs for details.";
    case "sagemaker":
      return "SageMaker: CloudWatch logs for the endpoint, IAM (InvokeEndpoint + execution role). See sagemaker/README.md.";
    default:
      return "Self-hosted: tunnel running, INFERENCE_API_URL origin correct, POST /generate reachable. See self-hosted-inference/README.md.";
  }
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const loraScale = typeof body.loraScale === "number" && Number.isFinite(body.loraScale) ? body.loraScale : 0.8;
  const numInferenceSteps =
    typeof body.numInferenceSteps === "number" && Number.isFinite(body.numInferenceSteps)
      ? Math.round(body.numInferenceSteps)
      : 30;
  const guidanceScale =
    typeof body.guidanceScale === "number" && Number.isFinite(body.guidanceScale) ? body.guidanceScale : 7.5;

  const seed =
    typeof body.seed === "number" && Number.isFinite(body.seed)
      ? Math.floor(body.seed)
      : Math.floor(Math.random() * 2 ** 31);

  const trigger = (process.env.LORA_TRIGGER_TOKEN ?? "div_rep").trim();
  const diversePrompt =
    trigger && !prompt.toLowerCase().includes(trigger.toLowerCase()) ? `${prompt}, ${trigger}` : prompt;

  const loraWeightsUrl = process.env.LORA_WEIGHTS_URL?.trim();
  if (!loraWeightsUrl) {
    return NextResponse.json(
      {
        error:
          "Missing LORA_WEIGHTS_URL. Use your Hugging Face file link: https://huggingface.co/<user>/<repo>/resolve/main/<file>.safetensors",
        hint: envBackendHint(),
      },
      { status: 500 },
    );
  }

  const mode = resolveBackendMode();

  if (mode === "replicate" && !process.env.REPLICATE_API_TOKEN?.trim()) {
    return NextResponse.json(
      {
        error: "Missing REPLICATE_API_TOKEN for Replicate backend.",
        hint:
          "For a free GPU path, set INFERENCE_API_URL to your Colab/ngrok or local FastAPI URL (see self-hosted-inference/README.md) and leave REPLICATE unset, or set IMAGE_GENERATION_BACKEND=self.",
      },
      { status: 500 },
    );
  }

  if (mode === "sagemaker") {
    if (!process.env.SAGEMAKER_ENDPOINT_NAME?.trim()) {
      return NextResponse.json(
        {
          error: "SageMaker backend selected but SAGEMAKER_ENDPOINT_NAME is missing.",
          hint: "See sagemaker/README.md — or use INFERENCE_API_URL for self-hosted Colab/local GPU.",
        },
        { status: 500 },
      );
    }
    if (!process.env.AWS_REGION?.trim() && !process.env.AWS_DEFAULT_REGION?.trim()) {
      return NextResponse.json(
        { error: "SageMaker requires AWS_REGION (or AWS_DEFAULT_REGION).", hint: envBackendHint() },
        { status: 500 },
      );
    }
  }

  if (mode === "self" && !process.env.INFERENCE_API_URL?.trim()) {
    return NextResponse.json(
      {
        error: "Self-hosted backend selected but INFERENCE_API_URL is missing.",
        hint: "Run self-hosted-inference/server.py on Colab or locally, expose it (ngrok), paste the https origin here.",
      },
      { status: 500 },
    );
  }

  const reqPayload = {
    baselinePrompt: prompt,
    diversePrompt,
    numInferenceSteps,
    guidanceScale,
    seed,
    loraScale,
    loraWeightsUrl,
  };

  try {
    const result = await generateComparison(reqPayload);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const upstreamStatus =
      typeof e === "object" &&
      e !== null &&
      "response" in e &&
      typeof (e as { response?: { status?: number } }).response?.status === "number"
        ? (e as { response: { status: number } }).response.status
        : undefined;

    let hint = defaultCatchHint();
    let status = 502;

    if (upstreamStatus === 402 || /402|Insufficient credit|Payment Required/i.test(message)) {
      status = 402;
      hint =
        "Replicate billing — add credit or use free Colab: set INFERENCE_API_URL and omit REPLICATE_API_TOKEN (see self-hosted-inference/README.md).";
    } else if (/429|Too Many Requests/i.test(message) && /replicate\.com/i.test(message)) {
      hint =
        "Replicate rate limit (429): wait a minute, click Generate less often, or upgrade your Replicate plan. This app runs baseline then debias **one after the other** by default; do not set REPLICATE_PARALLEL_PREDICTIONS unless your account tolerates two concurrent jobs.";
    } else if (/429|Too Many Requests/i.test(message) && /ngrok/i.test(message)) {
      hint =
        "ngrok (or tunnel) rate limit — free tiers throttle requests. Wait and retry, reduce double-clicks, or use a paid ngrok plan / different tunnel.";
    } else if (
      /Lora_url is required|lora_url is required/i.test(message) ||
      (/422|Input validation failed/i.test(message) && /replicate\.com|Replicate/i.test(message))
    ) {
      hint =
        "Replicate 422: your debias model expects a different JSON key for the LoRA URL than this app sends by default. On the model’s Replicate **API** tab, copy the **exact** input name (case matters, e.g. `Lora_url`), then set REPLICATE_DEBIAS_LORA_FIELD in .env.local. Match the LoRA **scale** field with REPLICATE_DEBIAS_SCALE_FIELD.";
    } else if (/Prediction failed:|file could not be opened successfully/i.test(message)) {
      hint =
        "Replicate finished the request but the **model container** failed (this is not SageMaker). Usually **`LORA_WEIGHTS_URL`** points to a file Replicate’s GPU cannot download (private/gated Hugging Face repo, HTML login page, or typo). Use a **public** HF file → **Copy download link** (`.../resolve/.../*.safetensors`), or host the file elsewhere with a direct HTTPS URL. Check the failed prediction on [replicate.com](https://replicate.com) for full logs.";
    } else if (/404.*models.*predictions|status 404/i.test(message)) {
      hint =
        "Replicate 404: pin REPLICATE_BASELINE_MODEL / REPLICATE_DEBIAS_MODEL to owner/name:version_digest from each model’s API page.";
    } else if (
      /timed out while waiting for a response from container|Your invocation timed out/i.test(message)
    ) {
      hint =
        "SageMaker sync InvokeEndpoint must return in ~60s (AWS limit). SDXL + LoRA often exceeds that — use an async inference endpoint + S3, or self-hosted INFERENCE_API_URL (see sagemaker/README.md §6a).";
    } else if (
      /Could not load credentials|CredentialsProviderError|security token.*invalid|not authorized to perform: ?sagemaker:InvokeEndpoint/i.test(
        message,
      )
    ) {
      hint =
        "AWS: set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (local dev), or use a role with sagemaker:InvokeEndpoint.";
    } else if (/SageMaker|InvokeEndpoint|ModelError/i.test(message)) {
      hint =
        "SageMaker: open CloudWatch for this endpoint. For timeouts see sagemaker/README.md §6a. For permissions, IAM needs sagemaker:InvokeEndpoint on the endpoint ARN.";
    } else if (/Self-hosted inference failed|fetch failed|ECONNREFUSED|ENOTFOUND/i.test(message)) {
      hint =
        "Tunnel or server down — restart Colab cells + ngrok, or your local uvicorn. If ngrok shows a browser warning page, set INFERENCE_API_NGROK_SKIP_BROWSER_WARNING=1 in .env.local.";
    }

    return NextResponse.json({ error: message, hint }, { status });
  }
}
