import { generateComparison } from "@/lib/generate-comparison";
import { NextResponse } from "next/server";

export const maxDuration = 300;

type Body = {
  prompt?: string;
  loraScale?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  seed?: number;
};

function selfHostedHint(): string {
  return "Self-hosted: confirm the GPU server is running, INFERENCE_API_URL is the public origin only, and POST /generate is reachable. See self-hosted-inference/README.md.";
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

  const inferenceApiUrl = process.env.INFERENCE_API_URL?.trim();
  if (!inferenceApiUrl) {
    return NextResponse.json(
      {
        error: "Missing INFERENCE_API_URL.",
        hint: "Run self-hosted-inference/server.py on a GPU host, expose it publicly, and set INFERENCE_API_URL to the origin only, e.g. https://api.example.com.",
      },
      { status: 500 },
    );
  }

  const loraWeightsUrl = process.env.LORA_WEIGHTS_URL?.trim();
  if (!loraWeightsUrl) {
    return NextResponse.json(
      {
        error:
          "Missing LORA_WEIGHTS_URL. Use your Hugging Face file link: https://huggingface.co/<user>/<repo>/resolve/main/<file>.safetensors",
        hint: "Set LORA_WEIGHTS_URL in your hosted Next.js environment. The self-hosted GPU server receives this URL in the /generate request.",
      },
      { status: 500 },
    );
  }

  const trigger = (process.env.LORA_TRIGGER_TOKEN ?? "div_rep").trim();
  const diversePrompt =
    trigger && !prompt.toLowerCase().includes(trigger.toLowerCase()) ? `${prompt}, ${trigger}` : prompt;

  try {
    const result = await generateComparison({
      baselinePrompt: prompt,
      diversePrompt,
      numInferenceSteps,
      guidanceScale,
      seed,
      loraScale,
      loraWeightsUrl,
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    let hint = selfHostedHint();

    if (/429|Too Many Requests/i.test(message) && /ngrok/i.test(message)) {
      hint =
        "ngrok or tunnel rate limit: wait and retry, reduce repeated Generate clicks, or move the inference server behind a stable public tunnel/domain.";
    } else if (/Self-hosted server returned non-JSON|ngrok/i.test(message)) {
      hint =
        "The inference URL returned something other than JSON. If this is ngrok, set INFERENCE_API_NGROK_SKIP_BROWSER_WARNING=1; otherwise confirm INFERENCE_API_URL points to the FastAPI origin, not a landing page.";
    } else if (/file could not be opened successfully|lora|safetensors|Hugging Face|huggingface/i.test(message)) {
      hint =
        "Check LORA_WEIGHTS_URL: it must be a direct, public HTTPS URL to the .safetensors file, or your GPU host must have Hugging Face credentials for a gated/private file.";
    } else if (/Self-hosted inference failed|fetch failed|ECONNREFUSED|ENOTFOUND/i.test(message)) {
      hint =
        "Tunnel or server down: restart the GPU server/tunnel and verify INFERENCE_API_URL is reachable from the hosted Next.js server.";
    }

    return NextResponse.json({ error: message, hint }, { status: 502 });
  }
}
