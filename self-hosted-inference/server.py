"""
Free GPU path: run on Google Colab (T4) or your own NVIDIA machine.

  pip install -r requirements.txt
  uvicorn server:app --host 0.0.0.0 --port 8000

Expose to the internet (Colab): use ngrok / cloudflared and set Next.js
INFERENCE_API_URL to the https origin (see README.md).

API matches lib/generate-comparison/self-hosted.ts.
"""

from __future__ import annotations

import base64
import hmac
import io
import os
import tempfile
import urllib.request
from typing import Any

import torch
from diffusers import StableDiffusionXLPipeline
from fastapi import FastAPI, Header, HTTPException
from PIL import Image
from pydantic import BaseModel, Field

app = FastAPI(title="Unlearning Bias — local SDXL")

_pipe: StableDiffusionXLPipeline | None = None
_lora_cache_url: str | None = None
_lora_cache_path: str | None = None


def _get_pipe() -> StableDiffusionXLPipeline:
    global _pipe
    if _pipe is not None:
        return _pipe

    model_id = os.environ.get(
        "SDXL_MODEL_ID", "stabilityai/stable-diffusion-xl-base-1.0"
    )
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

    _pipe = StableDiffusionXLPipeline.from_pretrained(
        model_id,
        torch_dtype=torch.float16,
        variant="fp16",
        use_safetensors=True,
        token=token,
    )
    _pipe.to("cuda")
    return _pipe


def _download_lora(url: str) -> str:
    global _lora_cache_url, _lora_cache_path
    if _lora_cache_url == url and _lora_cache_path and os.path.isfile(_lora_cache_path):
        return _lora_cache_path

    suffix = ".safetensors" if url.lower().endswith(".safetensors") else ".bin"
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    urllib.request.urlretrieve(url, path)
    _lora_cache_url = url
    _lora_cache_path = path
    return path


def _unload_lora(pipe: StableDiffusionXLPipeline) -> None:
    try:
        pipe.unload_lora_weights()
    except Exception:
        pass


def _image_to_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.standard_b64encode(buf.getvalue()).decode("ascii")


def _require_api_key(provided_key: str | None) -> None:
    expected_key = os.environ.get("INFERENCE_API_KEY", "").strip()
    if not expected_key:
        return
    if not provided_key or not hmac.compare_digest(provided_key, expected_key):
        raise HTTPException(status_code=401, detail="Invalid inference API key")


class GenerateBody(BaseModel):
    baseline_prompt: str
    diverse_prompt: str
    num_inference_steps: int = Field(ge=1, le=80)
    guidance_scale: float = Field(ge=1.0, le=20.0)
    seed: int
    lora_scale: float = Field(ge=0.0, le=2.0)
    lora_weights_url: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/generate")
def generate(
    body: GenerateBody,
    x_inference_api_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _require_api_key(x_inference_api_key)

    pipe = _get_pipe()
    _unload_lora(pipe)

    gen_b = torch.Generator(device="cuda").manual_seed(int(body.seed))
    out_b = pipe(
        prompt=body.baseline_prompt,
        num_inference_steps=int(body.num_inference_steps),
        guidance_scale=float(body.guidance_scale),
        generator=gen_b,
    ).images[0]

    lora_path = _download_lora(body.lora_weights_url)
    lora_dir = os.path.dirname(lora_path) or "."
    lora_name = os.path.basename(lora_path)

    pipe.load_lora_weights(lora_dir, weight_name=lora_name, adapter_name="ub_lora")
    if not hasattr(pipe, "set_adapters"):
        raise RuntimeError("Upgrade diffusers: set_adapters is required for LoRA scale.")
    pipe.set_adapters(["ub_lora"], adapter_weights=[float(body.lora_scale)])

    gen_d = torch.Generator(device="cuda").manual_seed(int(body.seed))
    out_d = pipe(
        prompt=body.diverse_prompt,
        num_inference_steps=int(body.num_inference_steps),
        guidance_scale=float(body.guidance_scale),
        generator=gen_d,
    ).images[0]

    _unload_lora(pipe)

    return {
        "baseline_image_b64": _image_to_b64(out_b),
        "diverse_image_b64": _image_to_b64(out_d),
        "mime_type": "image/png",
    }
