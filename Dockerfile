FROM python:3.12-slim

# Install system deps + chromium deps (WAJIB untuk Playwright)
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ffmpeg \
    ca-certificates \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Node deps
COPY package*.json ./
RUN npm install --omit=dev

# Copy project
COPY . .

# Python deps
RUN pip install --no-cache-dir \
    yt-dlp \
    requests \
    beautifulsoup4 \
    playwright \
    flask \
    flask-cors

# Install browser (ringan: chromium saja)
RUN playwright install chromium

ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

CMD ["node", "index.js"]
