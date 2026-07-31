#!/usr/bin/env bash
#
# generate_snapshot_link.sh — create/update the 'latest' and 'by-date'
# symlinks for one snapshot, on EITHER:
#   - a live snapper source tree, e.g. /.snapshots/<id>/snapshot, or
#   - a transferred snapshot on the Backup disk, e.g. <cfg_dest_root>/<id>
# The layout is auto-detected from what's actually on disk.
#
# Usage:
#   generate_snapshot_link.sh <snapshots_root> <snapshot_id> [info_xml_path]
#
# Examples:
#   # Live root-SSD snapper snapshot (layout: <root>/<id>/snapshot):
#   generate_snapshot_link.sh /.snapshots 439
#
#   # Transferred snapshot on the Backup disk (layout: <root>/<id>):
#   generate_snapshot_link.sh /run/media/amitp/Backup/home 439
#
# [info_xml_path]   optional explicit path to the snapper info.xml; if
#                    omitted, it's inferred based on the detected layout.
#
set -euo pipefail

CFG_DEST_ROOT="${1:?Usage: $0 <snapshots_root> <snapshot_id> [info_xml_path]}"
SNAP_ID="${2:?Usage: $0 <snapshots_root> <snapshot_id> [info_xml_path]}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

[[ -d "$CFG_DEST_ROOT" ]] || die "'${CFG_DEST_ROOT}' does not exist."
[[ "$SNAP_ID" =~ ^[0-9]+$ ]] || die "'${SNAP_ID}' is not a valid numeric snapshot id."

# Auto-detect layout:
#   Live snapper source:  <root>/<id>/snapshot    (+ <root>/<id>/info.xml)
#   Backup destination:   <root>/<id>             (+ <root>/<id>.info.xml)
if [[ -d "${CFG_DEST_ROOT}/${SNAP_ID}/snapshot" ]]; then
  LAYOUT="source"
  SNAP_TARGET_REL="${SNAP_ID}/snapshot"
  DEFAULT_INFO_XML="${CFG_DEST_ROOT}/${SNAP_ID}/info.xml"
elif [[ -d "${CFG_DEST_ROOT}/${SNAP_ID}" ]]; then
  LAYOUT="destination"
  SNAP_TARGET_REL="${SNAP_ID}"
  DEFAULT_INFO_XML="${CFG_DEST_ROOT}/${SNAP_ID}.info.xml"
else
  die "neither '${CFG_DEST_ROOT}/${SNAP_ID}/snapshot' nor '${CFG_DEST_ROOT}/${SNAP_ID}' exists — nothing to link."
fi

INFO_XML="${3:-$DEFAULT_INFO_XML}"
log "detected layout: ${LAYOUT} (target: ${SNAP_TARGET_REL})"

slugify_date() {
  echo "$1" | tr ' :' '_-'
}

# --- latest ---
latest_link="${CFG_DEST_ROOT}/latest"
ln -sfn "$SNAP_TARGET_REL" "$latest_link"
log "latest -> ${SNAP_TARGET_REL}"

# --- by-date ---
by_date_dir="${CFG_DEST_ROOT}/by-date"
mkdir -p "$by_date_dir"

date_raw=""
if [[ -f "$INFO_XML" ]]; then
  date_raw=$(sed -n 's:.*<date>\(.*\)</date>.*:\1:p' "$INFO_XML" | head -1)
else
  log "NOTE: no info.xml found at '${INFO_XML}' — using 'unknown-date' in the link name."
fi

if [[ -n "$date_raw" ]]; then
  slug=$(slugify_date "$date_raw")
else
  slug="unknown-date"
fi
link_name="${slug}_${SNAP_ID}"

# Remove any stale by-date link already pointing at this id (idempotent re-run)
find "$by_date_dir" -maxdepth 1 -type l -lname "../${SNAP_TARGET_REL}" -delete 2>/dev/null || true
ln -sfn "../${SNAP_TARGET_REL}" "${by_date_dir}/${link_name}"
log "by-date/${link_name} -> ../${SNAP_TARGET_REL}"
