#!/bin/bash
# Auto-sync wiki (public) + wiki-private with GitHub
# Runs via launchd every 15 minutes

LOG="/Users/meesh/gt/logs/wiki-sync.log"
mkdir -p "$(dirname "$LOG")"

sync_repo() {
  local dir="$1" label="$2"
  cd "$dir" || return 1
  echo "--- $label ($dir) ---"
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "$label: auto-sync $(date +%Y-%m-%d\ %H:%M)"
    echo "Committed local changes"
  fi
  git pull --rebase origin main 2>&1
  git push origin main 2>&1
}

{
  echo "=== $(date) ==="
  sync_repo /Users/meesh/wiki "wiki"
  sync_repo /Users/meesh/wiki-private "wiki-private"
  echo "Done"
} >> "$LOG" 2>&1
