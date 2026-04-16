---
title: Gas Town
status: active
started: 2026-02
created: 2026-04-11
updated: 2026-04-11
tags: [projects, gas-town, agent-orchestration]
---
# Gas Town

Multi-agent workspace manager. Mayor coordinates work across rigs, polecats execute.

## Location
- Source code: `/Users/meesh/gastown` (steveyegge/gastown Go repo)
- Workspace: `/Users/meesh/gt`

## Active Rigs
- **digital_marketing** — Autonomous outreach pipeline (GillyReach → enrichment → Instantly)
- **grow_seo** — SEO project
- **ems_billing** — EMS billing system
- **elevate** — TBD
- **enteract** — TBD

## Status
Questioning ROI vs plain tmux + native Anthropic features. Agent orchestration concept is valuable, but beads/mail infrastructure has been unreliable. Needs `gt doctor` health check.

## Key Decisions
- `.env` symlink pattern: single canonical `.env` at rig root, symlinked into worktrees
- Launchd auto-start: `~/Library/LaunchAgents/com.gastown.up.plist`
