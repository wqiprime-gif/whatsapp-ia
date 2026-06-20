FROM node:22-bookworm-slim

# Chromium do sistema (mais estável no Railway que cache do Puppeteer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libgbm1 \
    libgtk-3-0 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY hotbot/package.json hotbot/package-lock.json ./hotbot/
COPY tsconfig.json tsconfig.base.json ./

RUN npm ci --include=dev

COPY src ./src
COPY hotbot ./hotbot

RUN npm run build

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_BIN=/usr/bin/chromium
VOLUME ["/data"]

CMD ["npm", "start"]
