FROM node:20-slim

# install dependency dasar + python + ffmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    --no-install-recommends \
    && pip3 install --no-cache-dir yt-dlp requests \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 🔥 INSTALL PLAYWRIGHT + CHROMIUM
RUN npm install -g playwright \
    && npx playwright install chromium

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p audios videos

CMD ["node", "index.js"]
