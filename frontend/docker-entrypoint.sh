#!/bin/sh
set -e

# Set default values for backend connection
export BACKEND_HOST=${BACKEND_HOST:-backend}
export BACKEND_PORT=${BACKEND_PORT:-5000}

echo "Configuring nginx to proxy API requests to ${BACKEND_HOST}:${BACKEND_PORT}"

# Substitute environment variables in nginx config
# Only substitute BACKEND_HOST and BACKEND_PORT, preserve nginx variables like $uri
envsubst '${BACKEND_HOST} ${BACKEND_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start nginx
exec nginx -g 'daemon off;'
