FROM node:20

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --no-frozen-lockfile

# Build
WORKDIR /app/apps/api
RUN pnpm build

EXPOSE 8080

CMD ["npm", "start"]
