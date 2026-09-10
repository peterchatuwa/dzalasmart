# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Install dependencies
FROM base AS deps
COPY package*.json ./
COPY server/package*.json ./server/
RUN npm ci --only=production && \
    cp -R node_modules /tmp/prod_node_modules && \
    npm ci

# Development stage
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# Builder stage (run tests)
FROM development AS builder
RUN npm test

# Production stage
FROM base AS production
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
COPY --from=deps /tmp/prod_node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --chown=nodejs:nodejs . .
USER nodejs
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"
CMD ["npm", "start"]
