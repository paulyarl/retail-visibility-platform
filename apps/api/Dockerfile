FROM node:22

WORKDIR /app

# Heap headroom — tsc's type graph (build step) and the long-running production
# server both benefit from a higher V8 heap limit than the default ~4GB.
# 8GB for build (tsc type graph is large with the 7000+ line Prisma schema);
# 4GB would be enough for runtime alone, but setting 8GB here covers both phases.
ENV NODE_OPTIONS="--max-old-space-size=8192"

# Copy everything
COPY . .

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Build
WORKDIR /app/apps/api
RUN pnpm build

EXPOSE 8080

CMD ["npm", "start"]
