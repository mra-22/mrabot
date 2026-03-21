FROM node:22-slim

# Install dependency penting
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    git \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]
