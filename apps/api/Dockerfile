# Use Node.js LTS
FROM node:20-slim AS base

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy root package files and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy API package files
COPY apps/api/package.json ./apps/api/

# Install dependencies from root
RUN pnpm install --frozen-lockfile

# Copy API source code and prisma schema
COPY apps/api ./apps/api

# Generate Prisma Client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build TypeScript
RUN pnpm build

# Expose port
EXPOSE 8080

# Start command: run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
