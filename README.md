# Btrfs Snapshot Sync UI

A web-based UI for managing and monitoring Btrfs snapshot synchronization between local and backup disks.

## Features

- 📸 Browse and manage Btrfs snapshots
- 🔄 Trigger snapshot sync operations
- 📊 View sync status and logs
- 🎯 Support for multiple Snapper configurations (root, home, src)
- 🐳 Dockerized for easy deployment

## Tech Stack

### Backend
- Node.js with Express
- TypeScript (migration in progress)
- Btrfs send/receive integration

### Frontend
- React
- TypeScript (migration in progress)
- Modern UI with real-time updates

## Prerequisites

- Linux with Btrfs filesystem
- Node.js 18+
- Snapper installed
- Docker (optional)

## Quick Start

### Development
\`\`\`bash
./start-dev.sh
\`\`\`

### Docker
\`\`\`bash
docker-compose up -d
\`\`\`

## Configuration

Configure the following environment variables:

- `BACKUP_DISK`: Path to backup disk mount point
- `SCRIPTS_DIR`: Path to snapshot sync scripts
- `PORT`: API port (default: 3002)

## Project Structure

\`\`\`
.
├── backend/
│   ├── src/           # TypeScript source (WIP)
│   └── server.js      # Current JavaScript version
├── frontend/
│   └── src/           # React frontend
├── scripts/           # Sync scripts
└── docker-compose.yml
\`\`\`

## Roadmap

- ✅ Initial JavaScript implementation
- 🔄 TypeScript migration
- 📝 Complete API documentation
- 🧪 Add tests
- 📦 Package for distribution

## License

MIT
