# Btrfs Snapshot Sync UI

Full-stack dashboard for managing Btrfs snapshot transfers to external backup disk.

- **Backend**: Node.js/Express REST API
- **Frontend**: React dashboard with real-time sync monitoring
- **Deployment**: Docker Compose or systemd

## Features

- 📦 Browse all snapshots on backup disk, grouped by config (root/home/src)
- 💾 View snapshot metadata: date, description, size, file count
- 📊 Real-time disk usage visualization
- ▶️ Start new sync runs with one click
- 🔄 Stream sync progress in real-time
- 📝 View sync reports (Markdown)
- 🎯 Clean, dark-themed dashboard

## Prerequisites

- Node.js 18+ (for development) or Docker (for containerized deployment)
- External Btrfs backup disk mounted at `/run/media/amitp/Backup` (or configured path)
- The `btrfs_snapshot_sync.sh` script and supporting tools in `/home/amitp/bin/snapshot-sync/` (or configured path)

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone and navigate
git clone <repo-url>
cd snapshot-sync-ui

# Copy your snapshot sync scripts into a scripts/ subdirectory
mkdir -p scripts
cp /path/to/btrfs_snapshot_sync.sh scripts/
cp /path/to/generate_snapshot_link.sh scripts/
cp /path/to/btrfs_backup_cleanup.sh scripts/

# Start services
docker compose up -d

# Access dashboard at http://localhost:3000
# API at http://localhost:3001
```

### Option 2: Development (Node.js + npm)

```bash
# Backend
cd backend
npm install
npm start
# API runs on http://localhost:3001

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
# Dashboard runs on http://localhost:3000
```

### Option 3: Systemd Service

```bash
# Copy to /home/amitp/snapshot-sync-ui
sudo cp systemd/snapshot-sync-ui.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable snapshot-sync-ui
sudo systemctl start snapshot-sync-ui

# View logs
sudo journalctl -u snapshot-sync-ui -f
```

## Configuration

Environment variables (set in `.env` or Docker Compose):

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_DISK` | `/run/media/amitp/Backup` | Mount path of external Btrfs disk |
| `SCRIPTS_DIR` | `/home/amitp/bin/snapshot-sync` | Directory containing sync scripts |
| `PORT` | `3001` | API server port |

## API Endpoints

### Snapshots

- `GET /api/snapshots` — List all snapshots grouped by config
- `GET /api/snapshots/:config/:id` — Get detailed info for one snapshot
- `GET /api/disk` — Disk usage stats

### Sync Control

- `GET /api/sync/status` — Check if sync is running, get recent log
- `POST /api/sync/start` — Start a new sync run (blocks if one is active)
- `GET /api/sync/stream` — Stream sync progress (Server-Sent Events)

### Reports

- `GET /api/reports` — List sync reports
- `GET /api/reports/:filename` — Get report content (Markdown)

## Dashboard Tabs

### Snapshots
- View disk usage bar chart
- Browse snapshots by config (root, home, src)
- Each snapshot shows: ID, date, description, size, file count

### Sync
- See current sync status (Running / Ready)
- Start new sync with one click
- Live log of sync activity
- Real-time updates while sync is in progress

### Reports
- List recent sync reports
- View full report content (markdown formatted)
- Latest reports appear first

## How Syncs Work

1. Click **Start New Sync** in the Sync tab
2. Backend executes `btrfs_snapshot_sync.sh /run/media/amitp/Backup`
3. Log streams to the frontend in real-time
4. Script transfers up to 5 oldest not-yet-synced snapshots per config
5. Each transfer is verified (UUID, file count, size match)
6. Report is written to `<backup_disk>/reports/sync_report_<timestamp>.md`
7. Symlinks created (`latest`, `by-date/`)
8. UI updates automatically when sync completes

## Project Structure

```
snapshot-sync-ui/
├── backend/
│   ├── server.js          # Express API
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── App.jsx            # React dashboard
│   ├── App.css            # Styles
│   ├── main.jsx           # React entry
│   ├── index.html         # HTML template
│   ├── package.json
│   ├── vite.config.js     # Vite build config
│   └── Dockerfile
├── systemd/
│   └── snapshot-sync-ui.service
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Scripts Integration

The UI expects these scripts in `SCRIPTS_DIR`:

- `btrfs_snapshot_sync.sh` — Main sync runner (required)
- `generate_snapshot_link.sh` — Creates symlinks (called by sync script)
- `btrfs_backup_cleanup.sh` — Cleanup after interrupted syncs (optional)

If scripts are missing, the API will return a 404 when you try to start a sync.

## Development Notes

### Adding new features

1. **Backend**: Edit `backend/server.js`, restart server
2. **Frontend**: Edit `frontend/App.jsx` and `frontend/App.css`, changes hot-reload in dev mode
3. **Styling**: Uses CSS custom properties for dark theme consistency

### Debugging

- Backend logs: Check console output or Docker logs (`docker compose logs api`)
- Frontend logs: Browser DevTools Console
- API errors: Sent as JSON responses with 4xx/5xx status codes

## Troubleshooting

**"sync script not found"**: Ensure `btrfs_snapshot_sync.sh` is in the `SCRIPTS_DIR` path and is executable (`chmod +x`).

**"cannot stat filesystem of backup disk"**: Check that the backup disk is mounted and the path in `BACKUP_DISK` is correct.

**No snapshots showing**: Verify the backup disk contains subdirectories for each config (`root/`, `home/`, `src/`, etc.).

**Sync doesn't start**: Ensure the backend is running and has permission to execute the script. The API calls `sudo btrfs_snapshot_sync.sh`, so passwordless sudo setup may be needed:

```bash
# For the user running the API:
sudo visudo
# Add line: amitp ALL=(ALL) NOPASSWD: /home/amitp/bin/snapshot-sync/btrfs_snapshot_sync.sh
```

## License

MIT

## Author

Amit Perelman (aperelman@pm.me)
