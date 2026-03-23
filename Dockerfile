FROM node:20-slim

# 🔥 Install system deps (TERMASUK GIT WAJIB)
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    --no-install-recommends \
    && pip3 install --no-cache-dir -U yt-dlp requests --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 🔥 COPY dulu baru install (biar cache aman)
COPY package*.json ./

# 🔥 FIX npm issue
RUN npm config set fund false && npm config set audit false

RUN npm install

# 🔥 OPTIONAL (hapus kalau berat)
RUN npx playwright install chromium

COPY . .

RUN mkdir -p audios videos

CMD ["node", "index.js"]
