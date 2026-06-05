FROM node:22

WORKDIR /app

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
