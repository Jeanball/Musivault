#!/bin/sh
set -e

# Fix permissions for logs and uploads directories
# This runs as root before switching to nodejs user

echo "Fixing permissions for logs and uploads..."

# Create directories if they don't exist
mkdir -p /app/logs
mkdir -p /app/uploads
mkdir -p /app/uploads/covers

# Change ownership to nodejs user (UID 1001)
# we use the numeric ID to be safe, but username works if /etc/passwd is correct
chown -R nodejs:nodejs /app/logs
chown -R nodejs:nodejs /app/uploads

# Drop privileges and execute the command
exec su-exec nodejs "$@"
