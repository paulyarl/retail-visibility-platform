# Use Node.js LTS - node:20 already includes OpenSSL
FROM node:20 AS base

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy root package files for workspace setup
COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma/

# Install dependencies from root (monorepo setup)
RUN corepack prepare pnpm@latest --activate && \
    pnpm install --no-frozen-lockfile --prefer-offline

# Copy API source code
COPY apps/api ./apps/api/

# Set working directory to API
WORKDIR /app/apps/api

# Build TypeScript with error checking
RUN echo '🚀 Building with fresh Prisma Client generation...' && \
    npx prisma generate && \
    echo '📦 Compiling TypeScript...' && \
    npx tsc -p tsconfig.build.json --skipLibCheck && \
    echo '✅ Checking dist folder...' && \
    ls -la dist/ && \
    echo '✅ Checking index.js...' && \
    ls -la dist/index.js

# Expose port (Railway uses PORT env var)
EXPOSE ${PORT:-8080}

# Start command: run migrations then start server
CMD ["sh", "-c", "echo 'Running Prisma migrations...' && npx prisma migrate deploy 2>&1 && echo 'Migrations complete!' && echo 'Starting Node server...' && node dist/index.js 2>&1 || (echo 'ERROR: Server failed to start' && exit 1)"]
