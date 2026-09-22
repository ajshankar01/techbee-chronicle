# Multi-stage Dockerfile for TechBee FastAPI Backend
FROM python:3.11-slim as builder

WORKDIR /app

# Install system dependencies for build (weasyprint, pydub, ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    libffi-dev \
    libgobject-2.0-0 \
    pango1.0-tools \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt
RUN pip install --no-cache-dir --prefix=/install python-multipart SpeechRecognition pydub numpy sentry-sdk slowapi

FROM python:3.11-slim as runner

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgobject-2.0-0 \
    pango1.0-tools \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . /app

EXPOSE 8000

ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV MALLOC_TRIM_THRESHOLD_=100000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--limit-max-requests", "250", "--timeout-keep-alive", "30"]
