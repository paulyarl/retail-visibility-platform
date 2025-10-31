# Use Node.js LTS
FROM node:20-slim AS base

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy package files first (Railway builds from repo root)
COPY apps/api/package.json apps/api/pnpm-lock.yaml* ./
COPY apps/api/prisma ./prisma/

# Install dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install --no-frozen-lockfile

# Copy source code
COPY apps/api/ ./

# Build TypeScript
RUN pnpm build

# Expose port (Railway uses PORT env var)
EXPOSE ${PORT:-8080}

# Start command: run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
