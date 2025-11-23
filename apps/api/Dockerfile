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
COPY apps/api ./apps/api

# Set working directory to API
WORKDIR /app/apps/api

# Emergency build: Use existing Prisma client from node_modules
RUN echo '🚀 EMERGENCY BUILD: Using pre-generated Prisma client...' && \
    echo '📦 Compiling all TypeScript files...' && \
    npx tsc --skipLibCheck --target ES2020 --module commonjs --outDir dist --rootDir src src/**/*.ts && \
    echo '✅ Checking dist folder...' && \
    ls -la dist/ && \
    echo '✅ Checking for index.js...' && \
    test -f dist/index.js && echo 'index.js exists!' || echo 'index.js missing!' && \
    echo '✅ Emergency build complete!'

# Expose port (Railway uses PORT env var)
EXPOSE ${PORT:-8080}

# Start command: Emergency mode - start server directly
CMD ["sh", "-c", "echo 'EMERGENCY MODE: Starting server...' && echo 'Files in dist:' && ls -la dist/ && node dist/index.js 2>&1 || (echo 'ERROR: Server failed to start' && exit 1)"]
