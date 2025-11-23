# Use Node.js LTS - node:20 already includes OpenSSL
FROM node:20 AS base

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
