FROM node:22-slim

# Install dependencies sistem
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    git \
    ca-certificates \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp (CLI, bukan pip)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Set working directory
WORKDIR /app

# Copy package.json dulu (biar cache optimal)
COPY package*.json ./

# Install Node modules
RUN npm install

# Copy semua file project
COPY . .

# Jalankan bot
CMD ["npm", "start"]
