#!/usr/bin/env bash
#
# btrfs_backup_cleanup.sh — run after a reboot (e.g. following a killed/
# interrupted btrfs send|receive) to remove leftover partial subvolumes and
# do a basic health check on the backup disk before resuming syncs.
#
# What it does:
#   1. Safety check: refuses to run if a btrfs send/receive is somehow
#      still active (shouldn't be possible right after reboot, but checked
#      anyway rather than assumed).
#   2. Finds and removes any leftover subvolume literally named "snapshot"
#      under each config directory — this is always a partial/interrupted
#      receive target, never a legitimate finished snapshot (finished ones
#      get renamed to their numeric ID by btrfs_snapshot_sync.sh).
#   3. Prints basic filesystem health info (df, btrfs filesystem show,
#      btrfs device stats) so any real disk/hardware problem is visible
#      before you resume syncing.
#
# Usage:
#   sudo ./btrfs_backup_cleanup.sh /run/media/amitp/Backup
#
set -euo pipefail

DEST_ROOT="${1:?Usage: $0 <dest_root_on_external_btrfs>}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "must run as root (sudo)."
command -v btrfs >/dev/null || die "btrfs-progs not installed."
[[ -d "$DEST_ROOT" ]] || die "'${DEST_ROOT}' does not exist — is the disk mounted?"

DEST_FSTYPE=$(findmnt -no FSTYPE --target "$DEST_ROOT") || die "cannot stat filesystem of '$DEST_ROOT'."
[[ "$DEST_FSTYPE" == "btrfs" ]] || die "'${DEST_ROOT}' is '$DEST_FSTYPE', not btrfs."

# --- Safety check: refuse to run while any transfer is (somehow) active ---
if pgrep -f "btrfs (send|receive)" >/dev/null 2>&1; then
  die "a btrfs send/receive process is currently running — refusing to clean up while a transfer may be active. Investigate with: ps aux | grep -E 'btrfs (send|receive)'"
fi

log "No active btrfs send/receive processes — safe to proceed."
echo

# --- Step 1: remove leftover partial 'snapshot' subvolumes ---
log "Scanning for leftover partial subvolumes named 'snapshot' ..."
found_any=0

for cfg_dir in "$DEST_ROOT"/*/; do
  cfg_name=$(basename "$cfg_dir")
  [[ "$cfg_name" == "reports" ]] && continue

  leftover="${cfg_dir}snapshot"
  if [[ -d "$leftover" ]]; then
    found_any=1
    log "Found leftover partial subvolume: ${leftover}"
    size=$(du -sh --apparent-size "$leftover" 2>/dev/null | awk '{print $1}')
    log "  size: ${size:-unknown} (this was mid-transfer when interrupted)"
    read -r -p "  Delete this partial subvolume? Type 'yes' to confirm: " confirm
    if [[ "$confirm" == "yes" ]]; then
      btrfs subvolume delete "$leftover"
      log "  Deleted."
    else
      log "  Skipped (left in place)."
    fi
  fi
done

if [[ "$found_any" -eq 0 ]]; then
  log "No leftover partial subvolumes found. Nothing to clean."
fi

echo
log "=== Disk health check ==="
echo

echo "--- df -h ---"
df -h "$DEST_ROOT"
echo

echo "--- btrfs filesystem show ---"
btrfs filesystem show "$DEST_ROOT" || echo "  (command failed — possible filesystem issue, investigate before resuming syncs)"
echo

echo "--- btrfs device stats (error counters — any nonzero value is worth investigating) ---"
btrfs device stats "$DEST_ROOT" || echo "  (command failed — possible filesystem issue, investigate before resuming syncs)"
echo

echo "--- recent kernel messages mentioning this disk/usb/ata (last 30 matching lines) ---"
dmesg -T 2>/dev/null | grep -iE "usb|ata|sdb|btrfs" | tail -30 || echo "  (dmesg not accessible without additional privileges, or nothing matched)"

echo
log "Cleanup and health check complete."
log "If 'btrfs device stats' showed any nonzero error counters, or dmesg showed"
log "USB/ATA errors near last night's timestamps, investigate the physical"
log "connection/drive health before resuming the sync script."
