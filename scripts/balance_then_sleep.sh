#!/usr/bin/env bash
#
# balance_then_sleep.sh — blocks system sleep/idle-suspend while a btrfs
# balance is in progress on the given path, then automatically triggers
# suspend or hibernate once the balance finishes.
#
# This exists because desktop idle-suspend is normally based on keyboard/
# mouse inactivity, NOT disk I/O or CPU load — so an unattended balance can
# be interrupted by an ordinary idle-timeout suspend that has no idea a
# balance is running. systemd-inhibit is the correct cross-desktop way to
# prevent that, for exactly as long as needed and no longer.
#
# Usage:
#   ./balance_then_sleep.sh <backup_mount_path> [suspend|hibernate]
#
# Example:
#   ./balance_then_sleep.sh /run/media/amitp/Backup suspend
#
set -euo pipefail

DEST="${1:?Usage: $0 <backup_mount_path> [suspend|hibernate]}"
SLEEP_MODE="${2:-suspend}"

case "$SLEEP_MODE" in
  suspend|hibernate) ;;
  *) echo "ERROR: second argument must be 'suspend' or 'hibernate', got '${SLEEP_MODE}'" >&2; exit 1 ;;
esac

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "Blocking idle/sleep while btrfs balance is active on ${DEST} ..."
log "(this terminal must stay open/attached — run inside tmux if detaching)"

systemd-inhibit --what=sleep:idle \
                 --who="balance_then_sleep.sh" \
                 --why="btrfs balance in progress on ${DEST}" \
                 --mode=block \
  bash -c "
    while ! sudo btrfs balance status '${DEST}' 2>&1 | grep -qi 'no balance found'; do
      echo \"[\$(date '+%Y-%m-%d %H:%M:%S')] balance still running, checking again in 60s ...\"
      sleep 60
    done
  "

log "Balance complete (or was never running) — verifying disk is clean before sleeping."
sudo btrfs device stats "$DEST" || true

log "Triggering: systemctl ${SLEEP_MODE}"
sudo systemctl "$SLEEP_MODE"
