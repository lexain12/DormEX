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

# Build the backend Docker image
echo "Building backend Docker image..."
docker build -t campus-exchange-hub-01-backend:latest ./backend

# Build the frontend Docker image
echo "Building frontend Docker image..."
docker build -t campus-exchange-hub-01-frontend:latest ./frontend


# Start services with docker-compose
echo "Starting services..."
if command -v docker-compose &> /dev/null; then
    docker-compose up -d --build
else
    docker compose up -d --build
fi

echo "Deployment completed successfully!"
echo "Access the application at http://localhost/dormex"
echo "Backend API is available at http://localhost/api"