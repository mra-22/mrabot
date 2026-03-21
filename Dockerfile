FROM node:22-slim

# Install Python3 + FFmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency dulu (biar cache cepat)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy semua file
COPY . .

# Jalankan bot
CMD ["npm", "start"]
