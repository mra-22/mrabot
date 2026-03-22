# Gunakan Node yang ringan
FROM node:20-slim

# Install dependencies penting saja (ringan)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    git \
    curl \
    ca-certificates \
    && pip3 install --no-cache-dir yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json dulu (biar cache optimal)
COPY package*.json ./

# Install dependencies Node
RUN npm install

# Copy semua file
COPY . .

# Buat folder audio
RUN mkdir -p audios

# Jalankan bot
CMD ["node", "index.js"]
