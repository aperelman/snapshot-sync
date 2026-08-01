# Setup Guide

## Quick Start with Docker Compose

```bash
# 1. Clone the repo
git clone https://github.com/aperelman/snapshot-sync-ui
cd snapshot-sync-ui

# 2. Copy your snapshot sync scripts
mkdir -p scripts
cp /home/amitp/bin/snapshot-sync/*.sh scripts/

# 3. Make sure backup disk is mounted
# (normally at /run/media/amitp/Backup)

# 4. Start the stack
docker compose up -d

# 5. Open browser
open http://localhost:3000
```

Done. Dashboard is live.

## What's included

| Component | Port | Purpose |
|-----------|------|---------|
| Frontend (React) | 3000 | Dashboard UI |
| Backend (Express) | 3001 | REST API |

## Default paths (configurable)

- Backup disk: `/run/media/amitp/Backup`
- Scripts: `/home/amitp/bin/snapshot-sync`

Change in `docker-compose.yml` if different.

## First time

1. Click **Snapshots** tab — should see your configs (root, home, src)
2. Click **Disk** — shows usage
3. Click **Sync** tab, then **Start New Sync**
4. Watch progress in real-time
5. View report in **Reports** tab when done

## Passwordless sudo (required for sync)

Add to sudoers:
```bash
sudo visudo
# Add this line:
amitp ALL=(ALL) NOPASSWD: /home/amitp/bin/snapshot-sync/btrfs_snapshot_sync.sh
```

## To push to GitHub

```bash
# Initialize git
git init
git add .
git commit -m "Initial commit"

# Add remote and push
git remote add origin https://github.com/aperelman/snapshot-sync-ui
git branch -M main
git push -u origin main
```

Done.
