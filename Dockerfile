FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    git \
    --no-install-recommends \
    && pip3 install --no-cache-dir -U yt-dlp requests \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Playwright (opsional, kalau berat bisa dihapus)
RUN npx playwright install chromium

COPY . .

RUN mkdir -p audios videos

CMD ["node", "index.js"]
