FROM node:20-alpine
WORKDIR /app
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
