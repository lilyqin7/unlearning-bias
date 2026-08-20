# Unlearning Bias

Next.js app that compares **baseline SDXL** vs **SDXL + your LoRA** for the same prompt.

This repo uses one inference path:

**Browser** -> **Next.js `POST /api/generate`** -> **self-hosted FastAPI GPU server** -> **SDXL + LoRA**

The public Docker setup runs this as two containers:

- `web`: production Next.js app, exposed on port `3000`
- `inference`: CUDA/FastAPI GPU service, internal to Docker Compose

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the request flow and [self-hosted-inference/README.md](./self-hosted-inference/README.md) for the GPU server details.

---

## Docker Quick Start

The Docker path is intended for a host with an NVIDIA GPU, compatible drivers, and NVIDIA Container Toolkit.

1. Create a runtime env file:

   ```bash
   cp .env.docker.example .env.docker
   ```

2. Edit `.env.docker`:

   ```env
   LORA_WEIGHTS_URL=https://huggingface.co/you/repo/resolve/main/your-lora.safetensors
   INFERENCE_API_KEY=replace-with-a-long-random-secret
   HF_TOKEN=
   SDXL_MODEL_ID=stabilityai/stable-diffusion-xl-base-1.0
   ```

3. Build and start:

   ```bash
   docker compose --env-file .env.docker up --build
   ```

4. Open the app:

   ```txt
   http://localhost:3000
   ```

In production, put your public domain or reverse proxy in front of the `web` service. Do not expose the `inference` service directly unless you also add external auth/rate limiting.

---

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the GPU inference server manually or with Docker.

3. Create `.env.local`:

   ```env
   INFERENCE_API_URL=https://YOUR-GPU-API.example.com
   LORA_WEIGHTS_URL=https://huggingface.co/you/repo/resolve/main/your-lora.safetensors
   INFERENCE_API_KEY=replace-with-the-same-secret-as-the-gpu-server
   INFERENCE_API_NGROK_SKIP_BROWSER_WARNING=1
   ```

   `INFERENCE_API_URL` must be the origin only. Do not include `/generate`.

4. Run Next.js:

   ```bash
   npm run dev
   ```

---

## Docker Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Builds the production Next.js standalone server image. |
| `self-hosted-inference/Dockerfile` | Builds the CUDA/FastAPI SDXL inference image. |
| `docker-compose.yml` | Runs both services on one GPU host with Docker internal networking. |
| `.env.docker.example` | Template for runtime secrets and model settings. |
| `.dockerignore` | Keeps local build artifacts, env files, and caches out of Docker contexts. |

---

## Troubleshooting

| Issue | Check |
| --- | --- |
| 500 missing `INFERENCE_API_URL` | Set the public or Docker-internal origin of the FastAPI GPU server. |
| 500 missing `LORA_WEIGHTS_URL` | Set a Hugging Face **resolve** `.safetensors` URL. |
| 401 from inference | `INFERENCE_API_KEY` must match in the web and inference services. |
| Non-JSON / HTML from tunnel | If using ngrok, set `INFERENCE_API_NGROK_SKIP_BROWSER_WARNING=1`. |
| Docker cannot see GPU | Install NVIDIA drivers and NVIDIA Container Toolkit on the host. |
| Slow public generation | SDXL runs are expensive; use a persistent GPU host for public traffic. |
