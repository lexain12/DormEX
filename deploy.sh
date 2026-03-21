#!/bin/bash

# Deployment script for Campus Exchange Hub

set -e  # Exit on any error

echo "Starting deployment of Campus Exchange Hub..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Error: Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Stop and remove existing containers
echo "Stopping and removing existing containers..."
if command -v docker-compose &> /dev/null; then
    docker-compose down --remove-orphans || true
else
    docker compose down --remove-orphans || true
fi

# Force-remove any lingering containers with conflicting names
echo "Removing any conflicting containers..."
for name in campus_exchange_postgres campus_exchange_liquibase campus_exchange_backend campus_exchange_frontend; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
        echo "  Removing container: ${name}"
        docker rm -f "${name}" || true
    fi
done

# Remove old images
echo "Removing old Docker images..."
docker rmi campus-exchange-hub-01-backend:latest || true
docker rmi campus-exchange-hub-01-frontend:latest || true

# Build the backend Docker image
echo "Building backend Docker image..."
docker build -t campus-exchange-hub-01-backend:latest ./backend

# Build the frontend Docker image
echo "Building frontend Docker image..."
docker build -t campus-exchange-hub-01-frontend:latest ./frontend

# Start services with docker-compose
echo "Starting services..."
if command -v docker-compose &> /dev/null; then
    docker-compose up -d
else
    docker compose up -d
fi

# Update nginx config
NGINX_CONF_SRC="$(cd "$(dirname "$0")" && pwd)/nginx/nginx.conf"
NGINX_CONF_DST="/etc/nginx/sites-enabled/my_site"

if [ -f "$NGINX_CONF_SRC" ]; then
    echo "Updating nginx config at ${NGINX_CONF_DST}..."
    sudo cp "$NGINX_CONF_SRC" "$NGINX_CONF_DST"
    if sudo nginx -t; then
        sudo systemctl reload nginx
        echo "nginx reloaded successfully."
    else
        echo "Error: nginx config test failed. Reload skipped."
        exit 1
    fi
else
    echo "Warning: nginx config not found at ${NGINX_CONF_SRC}, skipping nginx update."
fi

echo "Deployment completed successfully!"
echo "Access the application at https://yjhv-solutions.ru/dormex"
echo "Backend API is available at https://yjhv-solutions.ru/dormex/api"