FROM node:20-slim

# 🔥 Install dependency penting saja
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 🔥 Copy package dulu (biar cache optimal)
COPY package*.json ./

# 🔥 Fix npm & install deps
RUN npm config set fund false \
    && npm config set audit false \
    && npm install --omit=dev

# 🔥 Copy semua file project
COPY . .

# 🔥 Folder output
RUN mkdir -p audios videos

# 🔥 Production mode
ENV NODE_ENV=production

CMD ["node", "index.js"]
