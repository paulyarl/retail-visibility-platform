# Use Node.js LTS
FROM node:20-slim AS base

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/

# Install dependencies (includes @supabase/supabase-js in dependencies now)
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Expose port (Railway uses PORT env var)
EXPOSE ${PORT:-8080}

# Start command: run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
