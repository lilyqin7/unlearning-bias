# Self-hosted GPU inference

This folder contains the FastAPI server that powers `POST /api/generate` in the Next.js app. Run it on Google Colab, a cloud GPU VM, or your own NVIDIA machine.

The Next.js app calls:

```txt
POST ${INFERENCE_API_URL}/generate
```

## Requirements

- NVIDIA GPU with CUDA
- Python environment that can install PyTorch, Diffusers, FastAPI, and Uvicorn
- Access to `stabilityai/stable-diffusion-xl-base-1.0` on Hugging Face
- A direct `.safetensors` LoRA URL for `LORA_WEIGHTS_URL`

## Hugging Face Setup

1. Open `https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0`.
2. Accept the model license if Hugging Face asks.
3. If the GPU host needs credentials, create a read token at `https://huggingface.co/settings/tokens`.
4. For your LoRA, copy the direct resolve/download URL. It should look like:

   ```txt
   https://huggingface.co/<you>/<repo>/resolve/main/<name>.safetensors
   ```

## Run on Google Colab

1. Create a new Colab notebook and choose a GPU runtime.
2. Upload this folder, or clone the repo and `cd` into `self-hosted-inference`.
3. Install dependencies:

   ```python
   %cd /content/self-hosted-inference
   !pip install -q -r requirements.txt
   ```

4. Set a Hugging Face token if needed:

   ```python
   import os
   os.environ["HF_TOKEN"] = "hf_xxxxxxxx"
   ```

5. Start FastAPI:

   ```python
   !nohup uvicorn server:app --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 &
   !sleep 3
   !curl -s http://127.0.0.1:8000/health
   ```

   You should see:

   ```json
   {"status":"ok"}
   ```

6. Expose the server with ngrok:

   ```python
   !pip install -q pyngrok
   from pyngrok import ngrok
   ngrok.set_auth_token("PASTE_YOUR_AUTHTOKEN_HERE")
   http_tunnel = ngrok.connect(8000, bind_tls=True)
   print("PUBLIC URL:", http_tunnel.public_url)
   ```

7. Put that public origin in the Next.js environment as `INFERENCE_API_URL`. Do not include `/generate`.

## Run on a Local or Cloud GPU

```bash
cd self-hosted-inference
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

Expose the service through your reverse proxy, tunnel, or cloud load balancer. The public URL must be reachable by the hosted Next.js server.

## Next.js Environment

Set these in `.env.local` for local development, or in your hosting provider's environment UI for public hosting:

```env
INFERENCE_API_URL=https://YOUR-GPU-API.example.com
LORA_WEIGHTS_URL=https://huggingface.co/you/repo/resolve/main/your-lora.safetensors
INFERENCE_API_NGROK_SKIP_BROWSER_WARNING=1
```

`INFERENCE_API_NGROK_SKIP_BROWSER_WARNING=1` is only needed for ngrok browser-warning responses.

## Security

Anyone who can reach `/generate` can burn GPU time. For public apps, put the GPU server behind a stable domain and add protection such as rate limiting, auth, or a reverse proxy allowlist that only permits traffic from your Next.js host.
