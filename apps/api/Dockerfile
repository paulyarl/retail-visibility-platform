# Use Node.js LTS
FROM node:20-slim AS base

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy all source code first (needed for prisma schema in postinstall)
COPY . .

# Install dependencies (without frozen lockfile since we're in a subdirectory)
RUN corepack enable && corepack prepare pnpm@latest --activate && pnpm install --no-frozen-lockfile

# Build TypeScript
RUN pnpm build

# Expose port
EXPOSE 8080

# Start command: run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
