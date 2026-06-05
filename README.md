# Unlearning Bias

Next.js app that compares **baseline SDXL** vs **SDXL + your LoRA** for the same prompt.

This repo uses one inference path:

**Browser** -> **Next.js `POST /api/generate`** -> **self-hosted FastAPI GPU server** -> **SDXL + LoRA**

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the request flow and file map. See [self-hosted-inference/README.md](./self-hosted-inference/README.md) for the GPU server setup.

---

## Quick Start

1. **Install**

   ```bash
   npm install
   ```

2. **Run the GPU inference server**

   Use `self-hosted-inference/server.py` on Google Colab, a cloud GPU VM, or a local NVIDIA machine. Expose port `8000` with a public HTTPS origin such as ngrok, Cloudflare Tunnel, or your own reverse proxy.

3. **Configure Next.js**

   Create `.env.local` in the project root:

   ```env
   INFERENCE_API_URL=https://YOUR-GPU-API.example.com
   LORA_WEIGHTS_URL=https://huggingface.co/you/repo/resolve/main/your-lora.safetensors
   INFERENCE_API_NGROK_SKIP_BROWSER_WARNING=1
   ```

   `INFERENCE_API_URL` must be the origin only. Do not include `/generate`.

4. **Run locally**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000), enter a prompt, and click **Generate**.

---

## Troubleshooting

| Issue                           | Check                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| 500 missing `INFERENCE_API_URL` | Set the public origin of your FastAPI GPU server.                                         |
| 500 missing `LORA_WEIGHTS_URL`  | Set a Hugging Face **resolve** `.safetensors` URL.                                        |
| Non-JSON / HTML from tunnel     | If using ngrok, set `INFERENCE_API_NGROK_SKIP_BROWSER_WARNING=1`.                         |
| Connection refused              | GPU server is down, tunnel is stale, or `INFERENCE_API_URL` includes the wrong host/path. |
| Slow public generation          | SDXL runs are expensive; use a persistent GPU host for public traffic.                    |
