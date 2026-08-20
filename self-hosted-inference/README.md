# Self-hosted GPU inference

This folder contains the FastAPI server that powers `POST /api/generate` in the Next.js app. It can run directly with Python or inside the CUDA Docker image defined here.

The Next.js app calls:

```txt
POST ${INFERENCE_API_URL}/generate
```

When `INFERENCE_API_KEY` is set, `/generate` requires:

```txt
x-inference-api-key: <shared secret>
```

`/health` stays public for container healthchecks.

## Docker Requirements

- NVIDIA GPU
- NVIDIA driver installed on the host
- NVIDIA Container Toolkit installed
- Docker Compose with GPU device support
- Access to `stabilityai/stable-diffusion-xl-base-1.0` on Hugging Face
- A direct `.safetensors` LoRA URL for `LORA_WEIGHTS_URL`

## Docker Usage

From the repo root:

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build
```

The inference container:

- runs `uvicorn server:app --host 0.0.0.0 --port 8000`
- mounts Hugging Face cache at `/models/huggingface`
- reads `HF_TOKEN` or `HUGGING_FACE_HUB_TOKEN` if the model requires auth
- reads `INFERENCE_API_KEY` to protect `/generate`

## Manual Python Usage

```bash
cd self-hosted-inference
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

Then set the Next.js app environment:

```env
INFERENCE_API_URL=http://127.0.0.1:8000
LORA_WEIGHTS_URL=https://huggingface.co/you/repo/resolve/main/your-lora.safetensors
INFERENCE_API_KEY=replace-with-the-same-secret
```

## Hugging Face Setup

1. Open `https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0`.
2. Accept the model license if Hugging Face asks.
3. If the GPU host needs credentials, create a read token at `https://huggingface.co/settings/tokens`.
4. For your LoRA, copy the direct resolve/download URL. It should look like:

   ```txt
   https://huggingface.co/<you>/<repo>/resolve/main/<name>.safetensors
   ```

## Security

Anyone who can reach `/generate` can burn GPU time. The Docker Compose setup keeps inference internal and uses a shared API key for defense in depth. For public deployments, expose only the web container through your reverse proxy or load balancer.
