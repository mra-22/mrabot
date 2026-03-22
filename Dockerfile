FROM node:20-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    ffmpeg \
    git \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Buat virtual env
RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Install yt-dlp di venv
RUN pip install --no-cache-dir yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p audios

CMD ["node", "index.js"]
