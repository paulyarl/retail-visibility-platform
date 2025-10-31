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
# Add explicit error handling and logging
CMD ["sh", "-c", "echo 'Running Prisma migrations...' && npx prisma migrate deploy && echo 'Starting Node server...' && node dist/index.js || (echo 'Server failed to start' && exit 1)"]
