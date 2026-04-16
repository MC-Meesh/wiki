---
title: Digital Marketing Pipeline
status: active
started: 2026-03
created: 2026-04-11
updated: 2026-04-11
tags: [projects, digital-marketing, email-outreach]
---
# Digital Marketing Pipeline

Autonomous cold email outreach system.

## Architecture
- **Lead source**: GillyReach ($0.06/contact) → CSV
- **Pipeline**: CSV → enrichment (DeepSeek) → email verification → copy generation (DeepSeek) → Instantly (sending)
- **Target**: 1k emails/day (25-30 mailboxes across 5-6 domains)

## Infrastructure
- **Domains**: elevateseorank.com (primary), elevateseoresults.com (secondary)
- **Mailboxes**: 5 on elevateseorank.com (chase@, mike@, sarah@, james@, emily@)
- **Current capacity**: ~200 emails/day post-warmup
- **Warmup**: Started 2026-03-09, takes 2-3 weeks
- **Scaling**: Need 25-30 mailboxes across 5-6 domains for 1k/day target

## Gas Town Beads
- dm-7w7: Epic — Autonomous Outreach Suite
- dm-5to: Instantly API integration
- dm-aau: Autonomous domain provisioning (blocked by dm-5to)
