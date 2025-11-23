# Use Node.js LTS - node:20 already includes OpenSSL
FROM node:20 AS base

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/

# Install dependencies from root (monorepo setup)
RUN corepack prepare pnpm@latest --activate && \
    pnpm install --no-frozen-lockfile --prefer-offline

# Copy API source code
COPY apps/api ./apps/api/

# Set working directory to API
WORKDIR /app/apps/api

# Simple build without Prisma validation issues
RUN echo '🚀 Emergency build - skipping Prisma generate for now...' && \
    echo '📦 Compiling TypeScript directly...' && \
    npx tsc --skipLibCheck --noEmit false --outDir dist src/index.ts && \
    echo '✅ Checking dist folder...' && \
    ls -la dist/ && \
    echo '✅ Build complete!'

# Expose port (Railway uses PORT env var)
EXPOSE ${PORT:-8080}

# Start command: start server directly (skip migrations for emergency)
CMD ["sh", "-c", "echo 'EMERGENCY MODE: Starting server directly...' && node dist/index.js 2>&1 || (echo 'ERROR: Server failed to start' && exit 1)"]
