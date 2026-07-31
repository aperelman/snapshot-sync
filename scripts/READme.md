# Btrfs Snapshot Backup Toolkit

Transfers snapper-managed Btrfs snapshots from the root SSD (`root`, `home`,
`src` configs) to an external Btrfs backup disk, with verification, a
browsable TUI, and human-readable symlinks — without relying on snapper
itself to know anything about the backup disk.

## Contents

| File | Purpose |
|---|---|
| `btrfs_snapshot_sync.sh` | Main transfer script. Sends the N oldest not-yet-synced snapshots per config to the backup disk, verifies each one, writes a report. |
| `generate_snapshot_link.sh` | Standalone: creates/updates `latest` and `by-date/` symlinks for one snapshot. Works on both live source snapshots and transferred backup snapshots (auto-detects layout). Called automatically by the sync script; also runnable by hand. |
| `btrfs_backup_manage.sh` | Interactive `fzf`-based TUI to browse, inspect, delete, restore, and auto-prune snapshots already on the backup disk. |
| `link_snapshot.sh` | Creates/removes `~/.snapshot` as a symlink to the backup disk's mount point. Meant to be run by systemd on mount/unmount, not manually. |
| `systemd/home-snapshot-link.service` | Systemd unit binding `link_snapshot.sh` to the backup disk's mount lifecycle. |
| `systemd/fstab_backup_snippet.txt` | Reference notes on the fstab entry (not needed on this machine — see below). |

## Prerequisites

```bash
sudo dnf install pv fzf btrfs-progs
```

- `pv` — live progress bar during transfers (optional; falls back to verbose-only logging if absent).
- `fzf` — required for the TUI.
- Destination disk must already be formatted **Btrfs** and have a stable mount path defined in `/etc/fstab` (already the case on this machine: `UUID=ed405612-...` → `/run/media/amitp/Backup`).

All `btrfs` operations (`send`, `receive`, `subvolume delete`, etc.) require root — every script here must be run with `sudo`.

## One-time setup

### 1. Confirm snapper's actual snapshot paths

```bash
snapper list-configs
```

The `CONFIGS` array at the top of `btrfs_snapshot_sync.sh` must match each
config's `<subvolume>/.snapshots` path exactly. On this machine:

```bash
declare -A CONFIGS=(
  [root]="/.snapshots"
  [home]="/home/.snapshots"
  [src]="/home/amitp/src/.snapshots"
)
```

### 2. Install the `~/.snapshot` convenience symlink (optional but recommended)

Makes the backup disk browsable at a fixed path whenever it's mounted,
without needing to remember `/run/media/amitp/Backup`.

```bash
mkdir -p ~/bin
cp link_snapshot.sh ~/bin/
chmod +x ~/bin/link_snapshot.sh

sudo cp systemd/home-snapshot-link.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now home-snapshot-link.service

# verify:
ls -la ~/.snapshot   # should show -> /run/media/amitp/Backup
```

This unit is bound (`BindsTo=`) to the disk's mount unit
(`run-media-amitp-Backup.mount`), so `~/.snapshot` appears when the disk is
mounted and is cleaned up when it's unmounted normally. An abrupt physical
unplug (no clean unmount) will leave `~/.snapshot` dangling harmlessly until
the next mount/unmount cycle — this is expected, not a bug.

## Day-to-day usage

### Running a sync

```bash
sudo ./btrfs_snapshot_sync.sh /run/media/amitp/Backup
```

- Sends up to `N_OLDEST` (default 5) oldest not-yet-transferred snapshots
  **per config** — so up to 15 total across `root`, `home`, `src` in one run.
- Uses **incremental** send/receive whenever a prior snapshot for that
  config is already confirmed on the disk; falls back to a **full** send
  otherwise (always true for the very first snapshot of a config).
- Every transfer is verified before being accepted (see "Sanity checks"
  below) — a failed check does **not** advance that config's state, so the
  same snapshot will be retried, not silently skipped, on the next run.
- Copies snapper's `info.xml` alongside each verified snapshot (as
  `<config>/<id>.info.xml`) — **required** to preserve the true snapshot
  date/description, since `btrfs send/receive` does not carry this over
  (the destination's own "Creation time" reflects *receive* time, not when
  snapper actually took the snapshot).
- Generates `latest` and `by-date/` symlinks for each verified snapshot via
  `generate_snapshot_link.sh`.
- Writes a Markdown report to `<dest>/reports/sync_report_<timestamp>.md`.

Safe to re-run at any time — already-synced snapshots are skipped, and it's
designed to be run repeatedly (e.g., periodically, or manually whenever the
disk is plugged in) rather than once.

### Sanity checks (what "verified" means)

After each transfer, four checks must **all** pass before a snapshot is
accepted:

1. Destination subvolume exists and is genuinely read-only.
2. **`Received UUID`** on the destination matches the source's own `UUID`
   (the strongest check — btrfs itself stamps this during receive as proof
   the transfer round-tripped correctly).
3. File count matches between source and destination.
4. Apparent size (bytes) matches between source and destination.

If any check fails, the snapshot is **not** marked synced and will be
retried on the next run. It does not necessarily mean the transfer was bad
— always cross-check with `btrfs subvolume show` on both sides before
assuming data loss (see Troubleshooting).

### Browsing / managing what's on the backup disk (TUI)

```bash
sudo ./btrfs_backup_manage.sh /run/media/amitp/Backup
```

| Key | Action |
|---|---|
| Type to search | Fuzzy-filter across config, ID, date, description |
| `Enter` | Full detail (raw `btrfs subvolume show` + original `info.xml`) |
| `Tab` | Multi-select |
| `Ctrl-D` | Delete selected snapshot(s) — asks for confirmation; warns if deleting the current incremental-send parent |
| `Ctrl-R` | Restore: makes a **writable** copy of a snapshot at a path you choose (received snapshots are read-only by default) |
| `Ctrl-P` | Auto-prune the selected row's config down to `KEEP_LAST` (default 10), oldest-first, with confirmation |
| `Esc` | Quit |

Override retention threshold per run:
```bash
sudo KEEP_LAST=5 ./btrfs_backup_manage.sh /run/media/amitp/Backup
```

### Generating symlinks manually (standalone use)

Useful for backfilling snapshots transferred before the symlink logic
existed, or for creating convenience links on a **live** (not yet
transferred) snapshot on the root SSD itself.

```bash
# Live snapshot still on the root SSD (auto-detects nested layout: <root>/<id>/snapshot)
sudo ./generate_snapshot_link.sh /.snapshots 439

# Transferred snapshot on the backup disk (auto-detects flat layout: <root>/<id>)
sudo ./generate_snapshot_link.sh /run/media/amitp/Backup/home 439
```

## Browsable results

Once synced, snapshots are ordinary directories — no special tooling needed
to just look at files:

```bash
ls /run/media/amitp/Backup/home/           # 439  708  latest  by-date/  reports/
ls /run/media/amitp/Backup/home/by-date/   # 2026-05-12_17-00-05_439  2026-07-10_09-30-00_708
cd /run/media/amitp/Backup/home/latest     # always the newest verified snapshot
```

With the systemd hook installed, the same is true via `~/.snapshot/home/...`
whenever the disk is mounted.

## Known limitations / things to watch

- **Disk space**: each snapshot on this system has run 200–300+ GiB. Check
  free space before letting a run process `root`/`src` for the first time:
  `df -h /run/media/amitp/Backup`. Consider running `Ctrl-P` (auto-prune) or
  a filtered `btrfs balance` (`sudo btrfs balance start -dusage=20 -musage=20 /run/media/amitp/Backup`)
  if usage is high — but never run a balance concurrently with an active
  sync, and start with a low `-dusage`/`-musage` threshold on a nearly-full
  disk rather than a full balance.
- **`info.xml` gaps**: any snapshot synced *before* this feature existed
  won't have one, and will show as `(unknown — no info.xml)` in the TUI.
  Backfill by copying it from the (still-live) source and re-running
  `generate_snapshot_link.sh`:
  ```bash
  sudo cp /home/.snapshots/<id>/info.xml /run/media/amitp/Backup/home/<id>.info.xml
  sudo ./generate_snapshot_link.sh /run/media/amitp/Backup/home <id>
  ```
  This only works while the original snapshot still exists on the source —
  once snapper prunes it, the metadata is gone for good.
- **Interrupting a transfer mid-flight**: safe to `Ctrl-C`, but leaves a
  partial, incompletely-received subvolume under the temporary name
  `snapshot` (btrfs receive always names the target after the source's
  basename before the script renames it). Clean up before re-running:
  ```bash
  sudo btrfs subvolume delete /run/media/amitp/Backup/<config>/snapshot
  ```
- **Single point of failure**: this toolkit maintains exactly one backup
  copy, on one physical disk. It protects against losing the *live*
  filesystem, but not against losing the backup disk itself (theft, fire,
  drive failure). Consider a second disk, off-site/SSH-based `btrfs send`,
  or cloud sync as a later phase if that risk matters to you.
- **snapper is unaware of any of this** — it only manages its own local
  `/.snapshots` trees under each config's retention policy. If snapper
  prunes a live snapshot before this script has transferred it, it's gone
  from the source but any already-transferred copy on the backup disk is
  unaffected.

## Troubleshooting

**"SANITY CHECK FAILED" but you suspect the transfer was actually fine:**
Compare the raw metadata directly before assuming data loss:
```bash
sudo btrfs subvolume show /home/.snapshots/<id>/snapshot
sudo btrfs subvolume show /run/media/amitp/Backup/<config>/<id>
```
If `Received UUID` on the destination equals `UUID` on the source, the
transfer is genuinely fine — this was a known false-positive in an earlier
version of the sanity check (fixed), and can still happen if you're running
an out-of-date copy of the script. Fix a false failure manually:
```bash
sudo bash -c 'echo "/home/.snapshots/<id>/snapshot" > /run/media/amitp/Backup/<config>/.last_synced_snapshot'
```

**A destination directory named literally `snapshot` (not a numeric ID)
sitting under a config folder:** this is either an in-progress receive
(normal, wait for it to finish) or a leftover from an interrupted transfer
(safe to delete once confirmed nothing is actively writing to it).

**Only one config's snapshots seem to transfer, others are skipped:** check
you're running the *current* copy of the script — the `CONFIGS` paths and
bug fixes described above only apply from a certain point onward in this
tool's history; an older cached copy on disk will silently misbehave
(e.g., wrong `src` path) without any obvious error.
