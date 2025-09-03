#!/bin/bash

# AIQ Frontend Docker Setup Script
set -e

echo "🎨 Starting AIQ Frontend..."

# Create shared network if it doesn't exist
if ! docker network ls | grep -q "aiq-shared-network"; then
    echo "🌐 Creating shared network..."
    docker network create aiq-shared-network
else
    echo "✅ Shared network already exists"
fi

# Build and start frontend
echo "🔨 Building frontend Docker image..."
docker-compose build frontend

echo "🚀 Starting frontend service..."
docker-compose up -d frontend

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 10

# Check frontend health
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is running at http://localhost:3000"
else
    echo "⚠️  Frontend health check failed - check logs with: docker-compose logs frontend"
fi

echo ""
echo "🎉 Frontend setup complete!"
echo ""
echo "📱 Frontend Access:"
echo "   UI:      http://localhost:3000"
echo ""
echo "🔧 Useful commands:"
echo "   View logs:    docker-compose logs -f frontend"
echo "   Stop:         docker-compose down"
echo "   Restart:      docker-compose restart frontend"
echo ""
echo "💡 Note: Make sure the backend is running at http://localhost:8081" 