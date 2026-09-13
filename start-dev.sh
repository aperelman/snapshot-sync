#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🧹 Cleaning up..."
pkill -f "vite\|ts-node\|nodemon" || true
docker-compose down -v 2>/dev/null || true
sleep 2

echo "🧹 Clearing ports..."
sudo fuser -k 3000/tcp 3001/tcp 3002/tcp 2>/dev/null || true
sleep 1

echo "✅ Starting backend..."
cd backend
npm run dev &
BACKEND_PID=$!

sleep 3

echo "✅ Starting frontend..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "🎉 Services ready:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""

wait
