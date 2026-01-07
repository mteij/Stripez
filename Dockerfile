# syntax=docker/dockerfile:1
FROM oven/bun:1.1-alpine

WORKDIR /app

# Install deps
COPY package.json ./
RUN bun install --ci

# App files
COPY src ./src
COPY public ./public

ENV NODE_ENV=production
EXPOSE 8080

CMD ["bun", "run", "src/server.tsx"]