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

# Emergency build with maximum debugging
RUN echo '🚀 EMERGENCY BUILD: Maximum debugging...' && \
    echo '📁 Current directory:' && pwd && \
    echo '📁 Contents of current directory:' && ls -la && \
    echo '📁 Contents of src directory:' && ls -la src/ && \
    echo '📦 Using simple tsc build...' && \
    npx tsc --version && \
    npx tsc --skipLibCheck --outDir dist --rootDir src --target ES2020 --module commonjs src/index.ts && \
    echo '✅ After tsc - checking dist folder:' && \
    ls -la dist/ && \
    echo '✅ Contents of dist folder:' && \
    find dist -type f -name "*.js" && \
    echo '✅ Checking if index.js exists:' && \
    test -f dist/index.js && echo 'SUCCESS: index.js found!' || (echo 'FAILED: index.js not found!' && exit 1)

# Expose port (Railway uses PORT env var)
EXPOSE ${PORT:-8080}

# Start command with debugging
CMD ["sh", "-c", "echo 'STARTING SERVER...' && echo 'Current directory:' && pwd && echo 'Contents of dist:' && ls -la dist/ && echo 'Starting node...' && node dist/index.js 2>&1 || (echo 'ERROR: Server failed to start' && exit 1)"]
