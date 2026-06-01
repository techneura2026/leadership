FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Install deps
FROM base AS deps
COPY package*.json ./
COPY api/package*.json ./api/
COPY shared/package*.json ./shared/
RUN npm ci --workspace=api --workspace=shared --include-workspace-root

# Build shared
FROM deps AS build-shared
COPY shared/ ./shared/
RUN npm run build -w shared

# Build api
FROM build-shared AS build
COPY api/ ./api/
RUN npm run build -w api

# Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=build /app/api/dist ./dist
COPY --from=build /app/api/node_modules ./node_modules
COPY --from=build /app/shared/dist ./node_modules/@leaderprism/shared
USER nestjs
EXPOSE 3001
CMD ["node", "dist/main"]
