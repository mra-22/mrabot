FROM python:3.12-slim

# Install dependencies (TERMASUK git)
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Install npm dependencies
RUN npm install --omit=dev

COPY . .

# Install yt-dlp
RUN pip install --no-cache-dir yt-dlp

ENV PYTHONUNBUFFERED=1

CMD ["node", "index.js"]
