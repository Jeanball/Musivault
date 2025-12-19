# Multi-stage build for optimized production image

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

# Build the application
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Re-declare build args
ARG VERSION
ARG COMMIT_SHA
ARG BUILD_DATE

# Add metadata labels
LABEL version=$VERSION
LABEL commit=$COMMIT_SHA
LABEL build_date=$BUILD_DATE

# Copy nginx config template for runtime substitution
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Environment variables for backend connection (can be overridden)
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=5000

# Use entrypoint script to substitute env vars and start nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
