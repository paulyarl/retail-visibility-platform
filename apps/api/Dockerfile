# Use Node.js LTS with pre-installed OpenSSL
FROM node:20-slim AS base

# Install OpenSSL and clean up in one layer to reduce image size
RUN apt-get update -y && \
    apt-get install -y openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/

# Install dependencies with optimized settings
RUN corepack prepare pnpm@latest --activate && \
    pnpm install --no-frozen-lockfile --prefer-offline

# Copy source code
COPY . .

# Build TypeScript
RUN echo '🚀 Building with fresh Prisma Client generation...' && \
    pnpm build

# Expose port (Railway uses PORT env var)
EXPOSE ${PORT:-8080}

# Start command: run migrations then start server
CMD ["sh", "-c", "echo 'Running Prisma migrations...' && npx prisma migrate deploy 2>&1 && echo 'Migrations complete!' && echo 'Starting Node server...' && node dist/index.js 2>&1 || (echo 'ERROR: Server failed to start' && exit 1)"]
