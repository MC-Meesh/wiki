#!/bin/bash
# Auto-sync wiki with GitHub
# Runs via launchd every 15 minutes
# Commits local changes, pulls remote changes (from reconciler), pushes

cd /Users/meesh/wiki || exit 1

LOG="/Users/meesh/gt/logs/wiki-sync.log"
mkdir -p "$(dirname "$LOG")"

{
  echo "=== $(date) ==="

  # Stage all changes
  git add -A

  # Commit if there are changes
  if ! git diff --cached --quiet; then
    git commit -m "wiki: auto-sync $(date +%Y-%m-%d\ %H:%M)"
    echo "Committed local changes"
  fi

  # Pull remote changes (from reconciler or other devices)
  git pull --rebase origin main 2>&1

  # Push
  git push origin main 2>&1

  echo "Done"
} >> "$LOG" 2>&1
