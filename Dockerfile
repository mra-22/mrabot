FROM node:20-bookworm

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    git \
    && pip3 install --no-cache-dir -U yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
