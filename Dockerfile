FROM node:20-slim

RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm config set fund false \
 && npm config set audit false \
 && npm install --omit=dev

COPY . .

RUN mkdir -p audios videos

CMD ["node", "index.js"]
