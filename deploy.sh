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
    docker-compose down || true
else
    docker compose down || true
fi

# Remove old images
echo "Removing old Docker images..."
docker rmi campus-exchange-hub-01-backend:latest || true
docker rmi campus-exchange-hub-01-nginx:latest || true

# Build the backend Docker image
echo "Building backend Docker image..."
docker build -t campus-exchange-hub-01-backend:latest ./backend

# Build the nginx image with bundled frontend
echo "Building nginx Docker image..."
docker build -t campus-exchange-hub-01-nginx:latest -f nginx/Dockerfile .

# Start services with docker-compose
echo "Starting services..."
if command -v docker-compose &> /dev/null; then
    docker-compose up -d
else
    docker compose up -d
fi

echo "Deployment completed successfully!"
echo "Access the application at http://localhost/dormex"
echo "Backend API is available at http://localhost/api/v1"
