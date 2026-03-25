FROM python:3.12-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ffmpeg \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json dulu (biar cache kepakai)
COPY package*.json ./

# Install npm deps
RUN npm install --omit=dev

# Copy semua file
COPY . .

# Install yt-dlp (WAJIB versi terbaru)
RUN pip install --no-cache-dir -U yt-dlp

# Tambahan penting (biar SSL & request stabil)
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

CMD ["node", "index.js"]
