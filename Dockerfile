FROM node:22-bookworm-slim

# Install Chromium, Thai fonts, and process reaper
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-thai-tlwg \
    fonts-noto-color-emoji \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium \
    CHROME_BIN=/usr/bin/chromium \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3020

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
