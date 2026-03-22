FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    git \
    curl \
    ca-certificates \
    && pip3 install --no-cache-dir yt-dlp requests --break-system-packages \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p audios videos

CMD ["node", "index.js"]
