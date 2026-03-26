FROM python:3.12-slim

# Install dependencies (ringan + penting)
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ffmpeg \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set workdir
WORKDIR /app

# Copy package.json dulu (biar cache optimal)
COPY package*.json ./

# Install dependency Node
RUN npm install --omit=dev

# Copy semua file
COPY . .

# Install yt-dlp (WAJIB latest)
RUN pip install --no-cache-dir -U yt-dlp

# Env
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

# Run bot
CMD ["node", "index.js"]
