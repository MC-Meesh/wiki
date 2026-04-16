---
title: Personal Infrastructure
created: 2026-04-11
updated: 2026-04-11
tags: [infrastructure, setup, claude]
topic: infrastructure
---
# Personal Infrastructure

Everything Claude needs to manage Chase's life, built in one evening.

## Architecture

```
Claude Code (CLI)
├── Obsidian Wiki (~/wiki/)          — knowledge base, todos, goals, journal
│   ├── GitHub sync (MC-Meesh/wiki)  — cross-device access via git
│   └── CLAUDE.md schema             — conventions enforced every session
├── Beancount Ledger (~/finances/)   — double-entry personal accounting
│   ├── SimpleFIN Bridge             — read-only bank data (WF, Schwab, Amex)
│   └── Import scripts               — automated transaction categorization
├── Gmail (MCP)                      — search, read, draft, label emails
├── Google Calendar (MCP)            — view events, find free time, create events
└── Gas Town (~/gt/)                 — multi-agent project orchestration
```

## What Claude Can Do

### Daily Operations
- Read and write wiki pages (todos, journal, goals, notes)
- Check calendar for scheduling context
- Search email for receipts, confirmations, threads
- Draft emails
- Pull latest bank transactions and categorize them
- Surface deadline items from backlog
- Create and manage daily task lists
- Track goal progress and hold Chase accountable

### Financial
- Pull real-time balances from 6 accounts across 3 institutions
- Import and auto-categorize transactions (579 txns, 27 categories, 0 errors)
- Run Fava for web-based financial dashboards
- Track reimbursements, compensation, tax documents

### Knowledge Management
- Triage inbox items into organized wiki pages
- Maintain cross-references via wikilinks
- Periodic lint checks for wiki health
- Import from external sources (Notion, CSVs, etc.)

## Security Model

| System | Access Level | How |
|--------|-------------|-----|
| Wiki | Full read/write | Local files, git push to private GitHub repo |
| Beancount | Full read/write | Local files |
| Bank accounts | **Read-only** | SimpleFIN Bridge (via MX). Cannot move money. Credentials stored by MX, not locally. Access token in gitignored .env |
| Gmail | Read + draft + label | Google OAuth via Claude MCP. Cannot send without confirmation. |
| Google Calendar | Read + create events | Google OAuth via Claude MCP |
| Gas Town | Full coordination | Local workspace, agent orchestration |

**Key security properties:**
- All data is local-first (~/wiki, ~/finances, ~/gt)
- Bank access is read-only by protocol design — no transfer/payment capability
- SimpleFIN access token is the only secret, stored in ~/finances/.env (gitignored)
- Wiki repo is private on GitHub
- No cloud databases, no SaaS lock-in, no proprietary formats
- Everything is plain text (markdown, beancount, JSON) — portable and auditable

## File Layout

```
~/
├── wiki/                    # Obsidian vault — personal knowledge base
│   ├── CLAUDE.md            # Schema: conventions, workflows, folder purposes
│   ├── inbox/               # Quick capture, raw dumps
│   ├── daily/               # Today's todos + archive + backlog
│   ├── goals/               # Goal hierarchy (north stars → quarterly)
│   ├── projects/            # High-level project docs
│   ├── personal/            # Journal, people, guitar, recipes, quotes
│   ├── notes/               # General notes, references
│   ├── finances/            # Financial docs (points to ~/finances/)
│   └── sources/             # Raw inputs (PDFs, clippings)
├── finances/                # Beancount ledger
│   ├── main.beancount       # Entrypoint
│   ├── accounts/            # Chart of accounts + balance assertions
│   ├── years/               # Transactions by year
│   ├── scripts/             # SimpleFIN importers
│   ├── imports/simplefin/   # Cached API responses
│   ├── docs/                # Reimbursements, tax docs
│   └── .env                 # SimpleFIN access URL (gitignored)
└── gt/                      # Gas Town workspace
    ├── mayor/               # Global coordinator (Claude)
    └── <rigs>/              # Project containers
```

## Connected Accounts

| Account | Institution | Type | Beancount |
|---------|-----------|------|-----------|
| Checking ...1427 | Wells Fargo | Checking | Assets:Cash:WellsFargo:Checking |
| Active Cash Visa ...8629 | Wells Fargo | Credit Card | Liabilities:CreditCard:WellsFargo |
| Platinum ...1022 | American Express | Credit Card | Liabilities:CreditCard:Amex |
| Roth IRA ...797 | Charles Schwab | Retirement | Assets:Investments:Schwab:RothIRA |
| Brokerage ...109 | Charles Schwab | Brokerage | Assets:Investments:Schwab:Brokerage |
| Investor Checking ...308 | Charles Schwab | Checking | Assets:Cash:Schwab:InvestorChecking |

## What Makes This Work

The core insight: **Chase interacts with Claude daily anyway.** Every other
organizational system (Notion, notebooks, Google Calendar, Quicken) failed
because it required separate effort to maintain. This system piggybacks on
the interaction that already happens — Claude manages the bookkeeping as a
side effect of doing actual work.

The wiki schema (CLAUDE.md) ensures consistency across sessions. The backlog
ensures nothing falls through the cracks. SimpleFIN ensures financial data
stays current without manual downloads. Gmail and Calendar provide context
without Chase having to relay it.

**Total cost: $15/year** (SimpleFIN). Everything else is free, local, open-source.
