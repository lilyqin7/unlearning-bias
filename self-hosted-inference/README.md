# Free GPU inference — concrete steps (with links)

**This folder is the primary inference package for the Colab-first branch** (see root `ARCHITECTURE.md`). It connects **your Next.js app** (`POST /api/generate`) to **SDXL on a free Colab GPU** or your **local NVIDIA GPU**. Replicate and SageMaker are optional; use `IMAGE_GENERATION_BACKEND=self` and `INFERENCE_API_URL` on the laptop.

---

## Part A — Hugging Face (model + LoRA URL)

1. **SDXL base model (plain 1.0)**  
   Open: [https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)  
   Log in, then click **Access repository** / accept the license if asked. The server downloads this id automatically (`SDXL_MODEL_ID` defaults to `stabilityai/stable-diffusion-xl-base-1.0`).

2. **Access token** (if downloads are gated)  
   Create a token: [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) (read access is enough). You will export it as `HF_TOKEN` in Colab (see Part C).

3. **Your LoRA file URL** (for `LORA_WEIGHTS_URL` in `.env.local`)
   - Open your model repo on Hugging Face, e.g. `https://huggingface.co/<you>/<repo>`.
   - Go to **Files and versions**, click your `.safetensors` file, use the **⋮** menu → **Copy download link** (or copy the **resolve** URL).
   - It should look like:  
     `https://huggingface.co/<you>/<repo>/resolve/main/<name>.safetensors`
   - Put that exact string in **`.env.local`** as `LORA_WEIGHTS_URL=...` on your laptop (see Part D).

---

## Part B — Google Colab (free GPU)

1. Open **Google Colab**: [https://colab.research.google.com/](https://colab.research.google.com/)
2. **File → New notebook**.
3. **Runtime → Change runtime type** → Hardware accelerator: **GPU** (often T4) → Save.
4. Mount your code (pick one):
   - **Upload files:** Upload `server.py` and `requirements.txt` from this repo’s [`self-hosted-inference/`](.) folder into Colab’s file sidebar.
   - **Or** clone git: `!git clone <your-repo-url>` then `cd your-repo/self-hosted-inference`.

---

## Part C — Run the API server in Colab

Run these cells **in order** (paths assume `server.py` and `requirements.txt` are in `/content/self-hosted-inference` — adjust `cd` if you cloned elsewhere).

**Cell 1 — install**

```python
%cd /content/self-hosted-inference  # change if needed
!pip install -q -r requirements.txt
```

**Cell 2 — Hugging Face token (only if hub blocks downloads)**

```python
import os
os.environ["HF_TOKEN"] = "hf_xxxxxxxx"  # paste from https://huggingface.co/settings/tokens
```

**Cell 3 — start FastAPI**

```python
!nohup uvicorn server:app --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 &
!sleep 3
!curl -s http://127.0.0.1:8000/health
```

You should see JSON like `{"status":"ok"}`. If not, run `!cat /tmp/uvicorn.log` to debug.

---

## Part D — Expose Colab to the internet (ngrok)

1. **Sign up / log in:** [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
2. **Copy your authtoken:** [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. In a **new Colab cell**:

```python
!pip install -q pyngrok
from pyngrok import ngrok
ngrok.set_auth_token("PASTE_YOUR_AUTHTOKEN_HERE")
http_tunnel = ngrok.connect(8000, bind_tls=True)
print("PUBLIC URL (use this in INFERENCE_API_URL):", http_tunnel.public_url)
```

4. Copy the printed `https://....ngrok-free.dev` (or similar) **origin only** — no trailing `/generate`.

**ngrok interstitial / non-JSON errors:** in your laptop’s `.env.local` add:

```env
INFERENCE_API_NGROK_SKIP_BROWSER_WARNING=1
```

---

## Part E — Wire your Next.js project (laptop)

Official Next env docs: [https://nextjs.org/docs/app/guides/environment-variables](https://nextjs.org/docs/app/guides/environment-variables)

1. In the **project root** (same folder as `package.json`), create or edit **`.env.local`**.
2. Set at least:

```env
INFERENCE_API_URL=https://YOUR-NGROK-SUBDOMAIN.ngrok-free.dev
LORA_WEIGHTS_URL=https://huggingface.co/you/repo/resolve/main/your-lora.safetensors
```

3. **Remove** `REPLICATE_API_TOKEN` for this path (or force backend):

```env
IMAGE_GENERATION_BACKEND=self
```

4. From the project root, restart the dev server:

```bash
npm run dev
```

5. Open the app, enter a prompt, click **Generate**. The Next server calls your Colab tunnel at `POST .../generate`.

**Keep Colab + ngrok cells “alive”** while you demo; if the runtime disconnects, repeat Part C–D and update `INFERENCE_API_URL`.

---

## Part F — Local NVIDIA machine (optional)

Same server, no ngrok:

```bash
cd self-hosted-inference
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

Then use:

```env
INFERENCE_API_URL=http://127.0.0.1:8000
```

(CUDA required; install the [PyTorch CUDA build](https://pytorch.org/get-started/locally/) that matches your driver if `pip install torch` is not enough.)

---

## Quick reference

| What              | Where                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Colab             | [https://colab.research.google.com/](https://colab.research.google.com/)                                                           |
| HF SDXL base      | [https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0) |
| HF tokens         | [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)                                                   |
| ngrok signup      | [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)                                                           |
| ngrok authtoken   | [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)                   |
| Next `.env.local` | [https://nextjs.org/docs/app/guides/environment-variables](https://nextjs.org/docs/app/guides/environment-variables)               |

---

## Security

Anyone with your ngrok URL can hit `/generate` and burn GPU time. Rotate the tunnel after class demos; do not commit `.env.local` (it should stay gitignored).
