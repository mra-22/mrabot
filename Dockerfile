# Base image Node + Debian
FROM node:20-bullseye

# Install dependencies untuk build Python
RUN apt-get update && apt-get install -y \
    wget \
    build-essential \
    zlib1g-dev \
    libncurses5-dev \
    libgdbm-dev \
    libnss3-dev \
    libssl-dev \
    libreadline-dev \
    libffi-dev \
    libsqlite3-dev \
    libbz2-dev \
    ffmpeg \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# =====================
# Install Python 3.12
# =====================
WORKDIR /usr/src

RUN wget https://www.python.org/ftp/python/3.12.2/Python-3.12.2.tgz \
    && tar -xzf Python-3.12.2.tgz \
    && cd Python-3.12.2 \
    && ./configure --enable-optimizations \
    && make -j$(nproc) \
    && make altinstall

# Pastikan python3.12 tersedia
RUN ln -s /usr/local/bin/python3.12 /usr/bin/python3 || true
RUN ln -s /usr/local/bin/pip3.12 /usr/bin/pip3 || true

# =====================
# Setup app
# =====================
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Upgrade pip untuk Python 3.12
RUN python3.12 -m ensurepip --upgrade || true
RUN python3.12 -m pip install --upgrade pip

# Install yt-dlp di Python 3.12
RUN python3.12 -m pip install --no-cache-dir yt-dlp

ENV PYTHONUNBUFFERED=1

EXPOSE 3000

CMD ["node", "index.js"]
