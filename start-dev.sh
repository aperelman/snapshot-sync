#!/bin/bash
echo "🚀 Resuming Btrfs Snapshot Sync development..."

cd /home/amitp/src/snapshot-sync/ui

# Start API
echo "📦 Starting API on port 3002..."
docker-compose up -d api

# Wait for API
sleep 3
echo "✅ API ready: http://localhost:3002/api/health"

# Start frontend
cd frontend
echo "🎨 Starting frontend on port 3000..."
npm run dev
