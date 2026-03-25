# Base image Python 3.12 (sudah siap, tidak compile)
FROM python:3.12-slim

# Install Node.js + ffmpeg
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json dulu
COPY package*.json ./

# Install Node dependencies
RUN npm install --omit=dev

# Copy project
COPY . .

# Install yt-dlp
RUN pip install --no-cache-dir yt-dlp

# Environment
ENV PYTHONUNBUFFERED=1

# Run bot
CMD ["node", "index.js"]
