# Multi-stage build for optimized image size

# Build arguments
ARG VERSION=dev
ARG COMMIT_SHA=unknown
ARG BUILD_DATE=unknown

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Re-declare build args for this stage
ARG VERSION
ARG COMMIT_SHA
ARG BUILD_DATE

# Set as environment variables
ENV APP_VERSION=$VERSION
ENV COMMIT_SHA=$COMMIT_SHA
ENV BUILD_DATE=$BUILD_DATE

# Add metadata labels
LABEL version=$VERSION
LABEL commit=$COMMIT_SHA
LABEL build_date=$BUILD_DATE

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Install su-exec
RUN apk add --no-cache su-exec


# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create logs directory inside /app (will be owned by root, then fixed by entrypoint)
RUN mkdir -p /app/logs/imports

# ENTRYPOINT will start as root to fix perms, then drop to user
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/server.js"]
