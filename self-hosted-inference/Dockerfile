FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV HF_HOME=/models/huggingface
ENV TRANSFORMERS_CACHE=/models/huggingface

COPY self-hosted-inference/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY self-hosted-inference/server.py ./server.py

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
