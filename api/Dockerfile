FROM node:20-alpine
WORKDIR /app
# Puppeteer (PDF report generation) needs a real Chromium: its own postinstall download is
# glibc-linked and won't run on Alpine's musl libc, so use Alpine's chromium package instead
# and skip that download entirely.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY package*.json ./
COPY api/package*.json ./api/
COPY shared/package*.json ./shared/
COPY web/package*.json ./web/
RUN npm ci --omit=dev
COPY shared/dist ./shared/dist
COPY api/dist ./api/dist
COPY api/src/database/init.sql ./api/src/database/init.sql
COPY api/src/database/seeds ./api/src/database/seeds
EXPOSE 3001
CMD ["node", "api/dist/api/src/main.js"]
