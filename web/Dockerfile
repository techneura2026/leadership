FROM node:20-alpine
WORKDIR /app
# npm ci installs every workspace's deps, including api's puppeteer — the web
# image never renders PDFs, so skip its ~170MB Chromium download.
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json ./
COPY api/package*.json ./api/
COPY shared/package*.json ./shared/
COPY web/package*.json ./web/
RUN npm ci --omit=dev
COPY shared/dist ./shared/dist
COPY web/.next ./web/.next
COPY web/public ./web/public
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "web"]
