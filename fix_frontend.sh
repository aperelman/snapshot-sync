#!/bin/bash

# Fix the frontend to use the full API URL
cd /home/amitp/src/snapshot-sync-ui/frontend/src

# Add API_BASE_URL at the top of App.jsx
if ! grep -q "API_BASE_URL" App.jsx; then
  echo "Adding API_BASE_URL to App.jsx"
  sed -i '1i const API_BASE_URL = "http://localhost:3001";' App.jsx
fi

# Update fetch calls in App.jsx
echo "Updating fetch calls in App.jsx"
sed -i 's|fetch("/api|fetch(`${API_BASE_URL}/api|g' App.jsx
sed -i 's|fetch('\''/api|fetch(`${API_BASE_URL}/api|g' App.jsx

# Update SnapshotBrowser.jsx if it exists
if [ -f SnapshotBrowser.jsx ]; then
  echo "Updating SnapshotBrowser.jsx"
  if ! grep -q "API_BASE_URL" SnapshotBrowser.jsx; then
    sed -i '1i const API_BASE_URL = "http://localhost:3001";' SnapshotBrowser.jsx
  fi
  sed -i 's|fetch("/api|fetch(`${API_BASE_URL}/api|g' SnapshotBrowser.jsx
  sed -i 's|fetch('\''/api|fetch(`${API_BASE_URL}/api|g' SnapshotBrowser.jsx
fi

echo "Frontend files updated"

# Rebuild and restart
cd /home/amitp/src/snapshot-sync-ui
docker-compose down
docker-compose build web
docker-compose up -d

sleep 5

# Test
echo ""
echo "Testing API health endpoint..."
curl -s http://localhost:3000/api/health
echo ""

echo "Testing snapshots endpoint..."
curl -s http://localhost:3000/api/snapshots | jq '.configs | keys'
echo ""

echo "Done!"
