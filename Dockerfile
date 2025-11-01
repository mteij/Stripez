# syntax=docker/dockerfile:1
FROM oven/bun:1.1-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json ./
RUN bun install --ci

# Copy source and static assets
COPY src ./src
COPY public ./public

# Runtime env
ENV NODE_ENV=production
EXPOSE 8080

# Start server (runs migrations on boot)
CMD ["bun", "run", "src/server.ts"]