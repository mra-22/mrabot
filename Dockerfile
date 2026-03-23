FROM node:20-slim

# install dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    ca-certificates \
    git \
    nodejs \
    npm \
    --no-install-recommends \
    && pip3 install --no-cache-dir -U yt-dlp requests \
    && rm -rf /var/lib/apt/lists/*

# 🔥 buat virtual environment (SOLUSI ERROR PIP)
RUN python3 -m venv /venv

# install python packages di venv
RUN /venv/bin/pip install --no-cache-dir --upgrade pip \
    && /venv/bin/pip install --no-cache-dir yt-dlp requests

# pakai python dari venv
ENV PATH="/venv/bin:$PATH"

WORKDIR /app

COPY package*.json ./
RUN npm install

# 🔥 playwright (opsional tapi oke)
RUN npx playwright install chromium

COPY . .

RUN mkdir -p audios videos

CMD ["node", "index.js"]
