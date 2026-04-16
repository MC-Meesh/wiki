---
title: Claude-Powered Personal Wiki — Full Setup Guide
created: 2026-04-12
tags: [guide, wiki, claude, setup]
---
# Claude-Powered Personal Wiki — Full Setup Guide

A fully automated personal knowledge system managed by Claude Code. Features:
- Obsidian wiki as the single source of truth for notes, todos, goals, finances
- Gmail triage with custom labels (Action Required, Review, Receipts, FYI)
- Daily todo reconciliation via cron (carries forward missed items, surfaces deadlines)
- Auto git-sync every 15 min (local ↔ GitHub ↔ remote agents)
- Google Calendar integration via MCP
- Accessible from Claude Code (desktop), Claude Web, SSH, or self-hosted webapp

---

## Prerequisites

### 1. Install Claude Code

```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Verify
claude --version
```

### 2. Run with full permissions (recommended for personal use)

```bash
claude --dangerously-skip-permissions
```

This skips per-tool confirmation prompts so Claude can edit files, run commands, and manage your system without interruption. Only use this on your own machine.

### 3. Install required CLIs

```bash
# GitHub CLI
brew install gh
gh auth login

# Google Cloud SDK (for Gmail OAuth)
brew install google-cloud-sdk
# OR: https://cloud.google.com/sdk/docs/install

# Node.js (for MCP servers, blog builds, etc.)
brew install nvm
nvm install --lts

# Git (should already be installed)
git --version
```

---

## Part 1: Obsidian Wiki Setup

### Create the wiki

```bash
mkdir -p ~/wiki/{daily,daily/archive,inbox,notes,personal/journal,projects,goals,finances,sources}
cd ~/wiki && git init
```

### Wiki structure

```
wiki/
├── daily/
│   ├── archive/          # Past daily files auto-moved here
│   ├── 2026-04-12.md     # Today's todo file
│   ├── backlog.md        # Items without a specific date
│   └── ...
├── inbox/                # Quick capture
├── notes/                # Reference material
├── personal/journal/     # Journal entries
├── projects/             # Active project docs
│   ├── _ideas.md         # Brainstorm backlog
│   └── <project>.md      # Individual project pages
├── goals/                # Goal hierarchy
├── finances/             # Beancount, budgets
├── sources/              # Bookmarks, reading list
└── CLAUDE.md             # Instructions for Claude about the wiki
```

### Daily file format

```markdown
---
date: 2026-04-12
status: pending
---
# 2026-04-12 (Saturday)

## Focus
- [ ] Task one
- [ ] Task two

## Carried Forward
- [ ] Missed task from yesterday (2026-04-11)

## Due Today
- [ ] ⚠️ due: 2026-04-12 — Something with a deadline
```

### Backlog format

Items without a specific date. Tag deadlines with `⚠️ due: YYYY-MM-DD` and the reconciler will surface them.

```markdown
# Backlog

## Urgent
- [ ] ⚠️ due: 2026-04-15 — Fund Roth IRA

## Follow-ups
- [ ] Some open item

## Projects
- [ ] Some project task
```

### Push to GitHub

```bash
cd ~/wiki
gh repo create <your-username>/wiki --private
git add -A && git commit -m "Initial wiki setup"
git branch -M main && git push -u origin main
```

### Install Obsidian

Download from https://obsidian.md — open `~/wiki` as a vault. Optional but nice for graph view and local browsing.

---

## Part 2: Claude Code System Prompt

Create `~/.claude/CLAUDE.md` — this is loaded for EVERY Claude Code session across all projects:

```markdown
# Wiki — Default Persistence Layer

The Obsidian wiki at `~/wiki/` is the **#1 way** for tracking personal information, tasks, todos, and notes. When asked to save anything (action items, todos, notes, goals), write it to the wiki using the structure already in place. Don't ask where to put it.

When updating the wiki, always show confirmation with the content written.
```

Also create `~/wiki/CLAUDE.md` with wiki-specific instructions:

```markdown
# Wiki Instructions

This is a personal Obsidian wiki. Structure:
- `daily/` — Daily todo files (YYYY-MM-DD.md format)
- `daily/backlog.md` — Items without specific dates
- `daily/archive/` — Past daily files
- `projects/` — Active project documentation
- `projects/_ideas.md` — Running brainstorm list
- `goals/` — Goal hierarchy and quarterly goals
- `notes/` — Reference material
- `personal/journal/` — Journal entries

## Conventions
- Daily files use `- [ ]` checkboxes for tasks
- Deadlines in backlog use `⚠️ due: YYYY-MM-DD` format
- Past daily files get moved to `daily/archive/` by the reconciler
- Never delete backlog items — they get carried forward or manually removed
```

---

## Part 3: Auto Git Sync

This keeps your local wiki in sync with GitHub so remote agents (and other devices) can read/write to it.

### Create sync script

```bash
cat > ~/wiki/.git-sync.sh << 'EOF'
#!/bin/bash
cd ~/wiki || exit 1
LOG=~/logs/wiki-sync.log
mkdir -p "$(dirname "$LOG")"
{
  echo "=== $(date) ==="
  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "wiki: auto-sync $(date +%Y-%m-%d\ %H:%M)"
    echo "Committed local changes"
  fi
  git pull --rebase origin main 2>&1
  git push origin main 2>&1
  echo "Done"
} >> "$LOG" 2>&1
EOF
chmod +x ~/wiki/.git-sync.sh
```

### macOS: Create launchd job (runs every 15 min)

```bash
cat > ~/Library/LaunchAgents/com.wiki.sync.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.wiki.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$HOME/wiki/.git-sync.sh</string>
  </array>
  <key>StartInterval</key><integer>900</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
</dict>
</plist>
EOF
launchctl load ~/Library/LaunchAgents/com.wiki.sync.plist
```

### Linux: Use cron

```bash
crontab -e
# Add: */15 * * * * /bin/bash ~/wiki/.git-sync.sh
```

---

## Part 4: Daily Todo Reconciler (Remote Agent)

A Claude agent runs every morning at 7am, checks for missed todos, creates today's file, and archives past days.

### Option A: Anthropic Cloud Trigger (easiest)

Go to https://claude.ai/code/scheduled and create a trigger:
- **Repo:** your wiki GitHub repo
- **Schedule:** `0 13 * * *` (7am MT = 1pm UTC, adjust for your timezone)
- **Prompt:**

```
You are a daily todo reconciler for an Obsidian wiki.

1. Check daily/ files from past 7 days for incomplete tasks (- [ ] items). Do NOT modify past files.
2. Check daily/backlog.md for items with due: YYYY-MM-DD tags that are today or past.
3. Create today's daily/YYYY-MM-DD.md if it doesn't exist.
4. Add ## Carried Forward section with incomplete items from past days.
5. Add ## Due Today / ## Overdue sections from backlog.
6. Move past daily files to daily/archive/.
7. Commit and push.

Never delete content from past files or backlog. Just move files to archive.
```

### Option B: Self-hosted server (more control)

Run on a VPS or homelab:

```bash
# Clone wiki
git clone https://github.com/<user>/wiki.git ~/wiki

# Cron job that runs Claude Code as a subagent
# Add to crontab:
0 7 * * * cd ~/wiki && git pull && claude -p "Reconcile today's todos. Check daily/ for incomplete items from past days, create today's file if needed, carry forward missed items, surface due backlog items, archive past daily files, commit and push." --dangerously-skip-permissions
```

---

## Part 5: Gmail Integration

Two approaches — use the built-in Claude.ai connector (read-only) or build a custom MCP server (full control, recommended).

### Option A: Built-in Claude.ai Gmail Connector

1. Go to https://claude.ai/settings/connectors
2. Connect Gmail
3. Available in Claude Web and remote triggers automatically

**Limitation:** Read-only. Can search and read emails but cannot label, trash, or mark as read.

### Option B: Custom Gmail MCP Server (recommended, 5 min setup)

This gives you full `gmail.modify` access — label, trash, mark read, create drafts.

```bash
# 1. Create project directory
mkdir -p ~/.gmail-mcp && cd ~/.gmail-mcp

# 2. Get OAuth credentials from Google Cloud Console
#    - Create project at https://console.cloud.google.com
#    - Enable Gmail API
#    - Create OAuth 2.0 credentials (Desktop app)
#    - Download as credentials.json to ~/.gmail-mcp/

# 3. Have Claude build the MCP server for you:
claude -p "Build me a Gmail MCP server using Python. It should:
- Use OAuth2 with credentials at ~/.gmail-mcp/credentials.json
- Request gmail.modify scope
- Provide tools: search_emails, mark_read, label_thread, trash_thread, create_draft
- Save token to ~/.gmail-mcp/token.json
- Set up as an MCP server compatible with Claude Code
Put the server code in ~/.gmail-mcp/server/" --dangerously-skip-permissions

# 4. Run the OAuth flow once (opens browser)
cd ~/.gmail-mcp/server && .venv/bin/python -m mcp_gmail.server

# 5. Add to Claude Code MCP config
cat > ~/.claude/.mcp.json << 'EOF'
{
  "mcpServers": {
    "gmail": {
      "command": "~/.gmail-mcp/server/.venv/bin/python",
      "args": ["-m", "mcp_gmail.server"],
      "cwd": "~/.gmail-mcp/server",
      "env": {
        "MCP_GMAIL_CREDENTIALS_PATH": "~/.gmail-mcp/credentials.json",
        "MCP_GMAIL_TOKEN_PATH": "~/.gmail-mcp/token.json"
      }
    }
  }
}
EOF
```

### Gmail Triage Labels

Ask Claude to create these labels and triage your inbox:

| Label | Purpose |
|-------|---------|
| Claude/Action Required | Bills, deadlines, needs your response |
| Claude/Review | Worth reading, not urgent |
| Claude/Receipts | Payment confirmations (archived) |
| Claude/FYI | Informational (archived) |

Claude can create labels via the API:

```python
# Claude will do this for you, but for reference:
service.users().labels().create(userId="me", body={
    "name": "Claude/Action Required",
    "labelListVisibility": "labelShow",
    "messageListVisibility": "show"
}).execute()
```

For bulk triage, Claude uses `batchModify` to process 1000 messages at a time — much faster than one-at-a-time.

---

## Part 6: Google Calendar Integration

### Option A: Built-in Claude.ai Connector

1. Go to https://claude.ai/settings/connectors
2. Connect Google Calendar
3. Available in Claude Web and remote triggers

### Option B: Custom MCP

Same pattern as Gmail — have Claude build a Calendar MCP server with OAuth2.

---

## Part 7: Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  GitHub (wiki repo)              │
│              Single source of truth              │
└──────────┬──────────────┬───────────────────────┘
           │              │
    ┌──────▼──────┐  ┌────▼────────────────┐
    │  Local Mac  │  │  Remote / Server     │
    │             │  │                      │
    │ Obsidian    │  │ Daily reconciler     │
    │ Claude Code │  │ (7am cron via        │
    │ Auto-sync   │  │  claude -p or        │
    │ (15min)     │  │  Anthropic trigger)  │
    │             │  │                      │
    │ Gmail MCP   │  │ Wiki webapp (future) │
    │ Calendar    │  │ WhatsApp bot (future)│
    └─────────────┘  └─────────────────────┘
```

### Data flow
1. You work with Claude Code locally → edits wiki → auto-sync pushes to GitHub
2. Remote reconciler runs at 7am → pulls from GitHub → creates daily file → pushes
3. Auto-sync pulls reconciler's changes → you see fresh daily file locally
4. Gmail MCP lets Claude triage your inbox with custom labels
5. Calendar MCP lets Claude check/create events

### Future: Self-hosted server
Deploy to a VPS with Claude Code installed. The server becomes the always-on hub:
- Runs the wiki repo
- Handles git sync
- Runs daily reconciler via `claude -p` cron
- Serves a webapp for mobile access
- Runs Gmail/Calendar crons
- No dependency on Anthropic cloud triggers

---

## Quick Start (TL;DR)

```bash
# 1. Install tools
npm install -g @anthropic-ai/claude-code
brew install gh
gh auth login

# 2. Create wiki
mkdir -p ~/wiki/{daily,daily/archive,inbox,notes,personal/journal,projects,goals,finances}
cd ~/wiki && git init
gh repo create $(whoami)/wiki --private
git add -A && git commit -m "init" && git push -u origin main

# 3. Set up system prompt
echo '# Wiki\nThe wiki at ~/wiki/ is the default place to save todos, notes, and tasks.' > ~/.claude/CLAUDE.md

# 4. Set up auto-sync
# (copy the .git-sync.sh and launchd plist from Part 3 above)

# 5. Set up daily reconciler
# (create Anthropic trigger or server cron from Part 4 above)

# 6. Launch Claude and tell it what you need
claude --dangerously-skip-permissions
# > "Set up Gmail MCP with full modify access"
# > "Triage my inbox — create labels and categorize everything"
# > "Create today's daily todo file with my tasks"
```

---

## Tips

- **Let Claude build your MCP servers.** It takes 5 minutes. Just describe what you want and it'll create the OAuth flow, server code, and config.
- **Use `--dangerously-skip-permissions`** for personal machines. The confirmation prompts slow everything down.
- **The wiki is the brain.** Every Claude session should know about it. Put instructions in `~/.claude/CLAUDE.md`.
- **Batch operations are fast.** Gmail's `batchModify` can process 1000 messages in one API call.
- **Custom MCP > built-in connectors** for write access. The built-in Gmail connector is read-only. A custom one gives full control.
- **Auto-sync is critical.** Without it, remote agents and local edits diverge.
