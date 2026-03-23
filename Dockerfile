FROM node:20-slim

# install ffmpeg saja (wajib untuk convert mp3)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# folder untuk audio
RUN mkdir -p audios

CMD ["node", "index.js"]
