#!/bin/bash
# Auto-sync wiki (public) + wiki-private with GitHub
# Runs via launchd every 2 minutes
# After push, pings Jazure webhook for instant pull

WEBHOOK_URL="https://wiki.mchaseallen.com/api/webhook?secret=wiki-sync-secret"
LOG="/Users/meesh/gt/logs/wiki-sync.log"
mkdir -p "$(dirname "$LOG")"

sync_repo() {
  local dir="$1" label="$2" notify="$3"
  cd "$dir" || return 1
  echo "--- $label ($dir) ---"
  git add -A
  local pushed=false
  if ! git diff --cached --quiet; then
    git commit -m "$label: auto-sync $(date +%Y-%m-%d\ %H:%M)"
    echo "Committed local changes"
    pushed=true
  fi
  git pull --rebase origin main 2>&1
  git push origin main 2>&1 && pushed=true

  # Notify Jazure pod to pull immediately
  if [ "$pushed" = true ] && [ "$notify" = true ]; then
    curl -s -X POST "$WEBHOOK_URL" --max-time 5 > /dev/null 2>&1 && echo "Notified Jazure" || true
  fi
}

{
  echo "=== $(date) ==="
  sync_repo /Users/meesh/wiki "wiki" true
  sync_repo /Users/meesh/wiki-private "wiki-private" false
  echo "Done"
} >> "$LOG" 2>&1
