---
title: Personal Wiki
created: 2026-04-12
updated: 2026-04-12
status: active
tags: [project, wiki, mobile, llm, hardware]
---
# Personal Wiki

Obsidian-based personal knowledge system managed by Claude. This is the central hub for notes, todos, goals, finances, and projects.

## Current State
- Wiki lives at `/Users/meesh/wiki/`, backed by GitHub (MC-Meesh/wiki)
- Claude Code reads/writes to it every session
- Desktop-only right now — no mobile or ambient access

---

## Mobile / Remote Access

### Problem
The wiki only works well from Claude Code on desktop. Need a way to read/write/chat with it on the go.

### Options (evaluating)

1. **Obsidian Git + Mobile App** — native Obsidian on iOS with git sync. Pro: free, native. Con: no Claude integration.
2. **WhatsApp/Telegram Bot → Claude API** — conversational wiki access from phone. Pro: low friction. Con: needs server + API costs.
3. **Simple Webapp (self-hosted)** ← **DOING THIS** — self-hosted server with Claude Code installed, wiki repo cloned, running the git auto-sync + daily reconciler via `claude -p` subagents instead of Anthropic cloud triggers. Lightweight web UI for mobile chat-with-wiki. Consolidates everything: wiki hosting, sync, cron tasks, mobile access. Pro: full control, no cloud trigger dependency, always-on = no sync gaps. Con: need VPS/homelab, most initial effort.
4. **Tailscale + SSH from Phone** — Termius/Blink → SSH into Mac → Claude Code. Pro: works today. Con: clunky.
5. **GitHub Synced + Claude Web** — push wiki to GitHub, use Claude Web's GitHub MCP. Pro: minimal setup. Con: sync friction.

### Likely path
Build option 3 (self-hosted webapp). Current interim setup: local launchd auto-sync every 15min + Anthropic cloud trigger for daily reconciler. Migrate both to the self-hosted server once it's up. The server runs Claude Code and can spawn subagents via `claude -p` for scheduled tasks.

---

## Smart Bathroom Mirror

One-way mirror with a screen behind it — programmable display pulling from the wiki.

### Concept
- Two-way mirror glass in front of a monitor/tablet (Raspberry Pi)
- Shows: time, weather, calendar, daily todos from wiki, news
- MagicMirror² (open source): https://magicmirror.builders/
- Cost: ~$100-200 for basic build
- Cool integration: wiki daily todos as a live widget

---

## Multi-Workspace Support (shared + private)

**Raised by James 2026-04-12:** can the llm-wiki support multiple workspaces, some private and some shared across users, so agents from different people can collaborate on shared project notes while keeping personal stuff separate?

**Yes — this is straightforward. It's just markdown dirs + an ACL layer.**

### Model
```
workspaces/
  personal-chase/        # only chase's agents can read/write
  personal-james/        # only james's agents
  shared-chase-james/    # both can read/write
  team-jazure/           # larger shared space, N members
```

Each workspace is its own git repo (so ownership/history is clean) or a subdir of a monorepo with path-based ACLs.

### Access control
- Per-workspace ACL: `{ workspace_id, user_id, role: reader|writer|admin }` stored server-side
- Auth via GitHub OAuth (we already have the app flow for Kubero/Woodpecker integration)
- API scopes Claude sessions to only the workspaces the auth'd user can touch
- Writes auto-tagged with author (frontmatter `author:` field or git commit identity) so you can see who wrote what in a shared space

### Agent behavior in shared workspaces
- Per-user memory/preferences stay in each user's private workspace
- Shared workspace has its own CLAUDE.md-style conventions doc that all agents read
- Claude sessions declare which workspaces are in-context at session start; writes go to an explicit target workspace, never ambiguous
- Conflict handling: treat shared workspace writes like PRs (agent writes to a branch, human reviews) for risky ops, or just direct commit for low-stakes notes

### Why it matters
Chase + James frequently collaborate on project context (Jazure deploy, shared beads, cross-project integrations). Today each side maintains parallel notes that drift. A shared workspace eliminates the duplication and gives both agents a canonical source of truth for the collab.

### MVP path
1. Add `workspaces/` dir with per-user subdirs
2. Simple YAML config `workspaces.yaml` defining access
3. Auth layer: GitHub OAuth, map GH user → ACL
4. Claude session scope: `--workspace=shared-chase-james` flag, or API header
5. Git ownership: each workspace is a git repo, pushed to a GH repo the owners share

---

## Invisible Meeting Transcription + Auto-Summary

Always-on ambient transcription that records meetings (in-person + virtual), transcribes them, produces an LLM summary + action items, and drops everything into a dedicated wiki folder. Zero friction — no "start recording" button, no post-meeting admin.

### Why this belongs in llm-wiki
Meeting notes are a high-volume, high-value knowledge stream that currently lives nowhere (or in scattered apps like Granola/Otter/Fireflies). Piping them into the wiki means:
- Claude has automatic context on every conversation you've had
- Cross-references emerge (this client mentioned X in meeting A, then in meeting B)
- Action items flow directly into daily todos via the reconciler
- Searchable archive of decisions, context, intros

### Target structure
```
wiki/meetings/
  2026-04-12/
    1930-fuzzy-jazure-walkthrough.md       # transcript + summary + actions
    1930-fuzzy-jazure-walkthrough.audio.m4a # raw audio (gitignored if size matters)
  2026-04-13/
    ...
```

Each meeting file frontmatter:
```yaml
---
date: 2026-04-12
time: 19:30
duration_min: 45
participants: [chase, james]
source: local-mic | zoom | meet | phone
tags: [jazure, kubero, infra]
---
```
Then: TL;DR, Action items (checked into daily todo), Decisions, Full transcript (collapsible).

### Capture paths (pick one or both)

1. **Local always-on (Mac)** — a background daemon using the system mic + speakers (BlackHole/Loopback for tab audio) → Whisper.cpp or Parakeet-local → LLM summary
   - Pro: works for in-person + any app (Zoom, Meet, phone via speakerphone)
   - Pro: fully private, no SaaS
   - Con: battery/CPU cost, needs consent handling (states with two-party consent laws)

2. **Calendar-triggered** — watches gcal, joins meetings as a bot (or uses the Meet/Zoom recording API), transcribes after
   - Pro: no always-on daemon
   - Con: misses in-person + ad-hoc calls; bot attendee is a bit awkward

3. **Hardware button / wake word** — a physical trigger ("OK Chase, record") or a shortcut-key toggle
   - Pro: explicit consent, battery friendly
   - Con: forget-to-start failure mode

**Likely answer: 1 + 3 combined** — always-on local daemon with a hotkey to mark in/out ("this segment is worth keeping"). Default is rolling buffer that discards after N minutes unless marked.

### Tech stack (draft)
- **Capture**: Swift menu-bar app or Python daemon using AVFoundation (Mac). BlackHole virtual audio device for capturing system audio.
- **Transcription**: Whisper.cpp (large-v3) or Parakeet-0.6b local. ~1x realtime on M-series.
- **Diarization**: pyannote-audio for speaker labels. Critical for multi-party meetings.
- **Summary**: Claude Sonnet 4.6 (fits in free cycles) — structured output with TL;DR, actions, decisions, key quotes.
- **Action extraction**: Prompt the LLM to emit `- [ ] action` lines, then the daily reconciler picks them up and promotes them to today's/tomorrow's todos.
- **Storage**: markdown in `wiki/meetings/YYYY-MM-DD/`, audio in blob storage or gitignored local dir.

### Privacy / consent
- Visible indicator when recording (menu bar icon, red dot)
- Explicit participant notification on join for remote meetings
- Per-state config (two-party consent jurisdictions)
- Encryption at rest for audio files
- "Forget this meeting" action that purges transcript + audio

### Integration with agents
- `@claude what did james and I decide about the kubero fork?` → Claude searches `wiki/meetings/*` for relevant threads
- Daily reconciler adds "pending action items from meetings" to today's todo list
- Weekly digest: Claude summarizes the week's meetings into a journal entry

### MVP scope (first pass)
- [ ] Menu-bar Mac app that records on hotkey, transcribes via Whisper.cpp, and writes a `.md` file to `wiki/meetings/`
- [ ] Post-record Claude pass: summary + action items appended to the transcript file
- [ ] Reconciler hook: surface new action items in tomorrow's daily file

### Prior art / competition
- Granola — great UX, SaaS, $$
- Otter.ai — transcription focus, weak summaries
- Fireflies — calendar-triggered bot, virtual meetings only
- Rewind.ai — always-on screen+audio, expensive, lock-in

None of them own your data or integrate into a wiki. That's the wedge.

---

## Ideas / Extensions
- [ ] Voice interface — ask questions about wiki via Siri/Alexa shortcut → Claude API
- [ ] Auto-journaling — Claude summarizes each day's work into a journal entry
- [ ] Wiki search engine — local semantic search across all notes
- [ ] Dashboard view — web page that renders today's todos, upcoming deadlines, recent journal entries

---

## Milestones
- [x] Wiki created and in daily use via Claude Code
- [x] Notion content migrated
- [x] Gmail triage labels integrated
- [ ] Get Obsidian Git syncing on phone
- [x] Auto-sync launchd job (every 15min push/pull)
- [x] Daily reconciler remote trigger (7am MT)
- [ ] Stand up self-hosted server (VPS or homelab)
- [ ] Migrate sync + reconciler from cloud/launchd → server `claude -p` crons
- [ ] Build webapp UI for mobile wiki access + Claude chat
- [ ] Smart mirror prototype
