# Unlearning Bias (Colab-first)

Next.js app that compares **baseline SDXL** vs **SDXL + your LoRA** for the same prompt. On this branch the **intended path** is:

**Laptop (Next.js)** → **ngrok URL** → **Google Colab GPU** running `self-hosted-inference/server.py`.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for a diagram and folder map. Full Colab/ngrok steps: **[self-hosted-inference/README.md](./self-hosted-inference/README.md)**.

---

## Quick start (Colab + Next.js)

1. **Install**

   ```bash
   npm install
   ```

2. **Colab** — New notebook, **GPU** runtime, upload or clone this repo’s **`self-hosted-inference/`** folder, install deps, run `uvicorn`, expose port **8000** with **ngrok** (see linked README).

3. **`.env.local`** (project root, next to `package.json`):

   ```env
   INFERENCE_API_URL=https://YOUR-SUBDOMAIN.ngrok-free.app
   LORA_WEIGHTS_URL=https://huggingface.co/you/repo/resolve/main/your-lora.safetensors
   IMAGE_GENERATION_BACKEND=self
   INFERENCE_API_NGROK_SKIP_BROWSER_WARNING=1
   ```

   Omit `REPLICATE_API_TOKEN`, `SAGEMAKER_ENDPOINT_NAME`, and `AWS_*` unless you use those backends.

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and click **Generate** while Colab + ngrok stay connected.

---

## Optional backends

| Backend | When to use | Docs |
|--------|-------------|------|
| **Replicate** | Fastest setup; paid API, no Colab | Root **`.env.example`** Replicate block, `lib/generate-comparison/replicate.ts` |
| **SageMaker** | AWS-hosted GPU; note sync invoke limits | **`sagemaker/README.md`** |

---

## Troubleshooting (Colab)

| Issue | Check |
|-------|--------|
| 500 missing `LORA_WEIGHTS_URL` | Set HF **resolve** `.safetensors` URL in `.env.local`. |
| Wrong backend | `IMAGE_GENERATION_BACKEND=self`; remove stray `SAGEMAKER_ENDPOINT_NAME`. |
| Non-JSON / HTML from tunnel | `INFERENCE_API_NGROK_SKIP_BROWSER_WARNING=1`. |
| Connection refused | Colab runtime still running, ngrok tunnel fresh, `INFERENCE_API_URL` is **origin only** (no `/generate`). |

---

## Deploy / Vercel

Server-side generation needs your **Colab URL** or cloud GPU reachable from the deploy region; secrets go in the host’s env UI, not the repo. See [Next.js env docs](https://nextjs.org/docs/app/guides/environment-variables).
