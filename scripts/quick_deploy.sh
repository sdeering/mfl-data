#!/bin/bash

echo "🚀 Quick ML API Deployment"
echo "=========================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Stop any existing container
echo "🛑 Stopping existing ML API container..."
docker-compose down 2>/dev/null || true

# Build and start the container
echo "🔨 Building and starting ML API..."
docker-compose up -d --build

# Wait for the API to start
echo "⏳ Waiting for ML API to start..."
sleep 10

# Test the health endpoint
echo "🔍 Testing health endpoint..."
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ ML API is running successfully!"
    echo "🌐 Health endpoint: http://localhost:8000/health"
    echo "🔗 Predict endpoint: http://localhost:8000/predict"
else
    echo "❌ ML API failed to start. Check logs:"
    docker-compose logs
    exit 1
fi

echo "🎉 Deployment complete! Your ML API is now running on port 8000."
