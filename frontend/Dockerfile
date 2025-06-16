# Use official Node 20 Alpine image
FROM node:20-alpine

# Enable Yarn 4+ corepack
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy package files first for optimal caching
COPY package.json pnpm-lock.yaml ./

# Install production dependencies (Yarn 4+)
# COPY .pnpm ./.pnpm
RUN pnpm install

# Copy application files
COPY . .

# Set non-root user for security
RUN chown -R node:node /app
USER node

# Expose application port
EXPOSE 3000

ENV NODE_ENV=development

# Start command
CMD ["pnpm", "start"]