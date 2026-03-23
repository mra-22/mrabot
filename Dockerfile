# Gunakan base image Node + Debian
FROM node:20-bullseye

# Install Python + pip + ffmpeg + dependency lain
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json dulu (biar cache jalan)
COPY package*.json ./

# Install Node dependencies
RUN npm install --omit=dev

# Copy semua file project
COPY . .

# Install Python dependencies (yt-dlp WAJIB)
RUN pip3 install --no-cache-dir yt-dlp

# Optional: kalau kamu punya requirements.txt
# RUN pip3 install --no-cache-dir -r requirements.txt

# Set environment biar python aman
ENV PYTHONUNBUFFERED=1

# Expose port (kalau ada web, kalau bot WA bisa diabaikan)
EXPOSE 3000

# Run bot kamu
CMD ["node", "index.js"]
