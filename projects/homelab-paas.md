---
title: Homelab PaaS - Open Source Vercel/Railway Replacement
created: 2026-04-12
updated: 2026-04-12
tags: [projects, open-source, devtools, k8s, homelab]
collaborators: [chase, fuzzy]
status: idea-committed
---
# Homelab PaaS

Open-source developer tool that replaces the Vercel + Railway stack for homelabs and self-hosted clusters. Think Coolify's simplicity meets Kubero's cluster support, but actually good.

## Core Idea

A clean, simple PaaS for deploying apps on your own hardware, whether a single box (Coolify-style) or a k8s cluster (Kubero-style). The homelab community is growing fast and the existing tools (Coolify, Kubero, CapRover) all have rough edges.

## Scope (Phase 1)

- Deploy apps to single-node or k8s clusters
- Horizontal pod scaling
- Simple pipelines and administration
- Git-push deploy workflow (like Vercel/Railway)
- Custom domain routing with SSL

## Explicitly Out of Scope (for now)

- Database/data layer (Supabase replacement). Storage is per-user nightmare territory, and Supabase is annoying to self-host. Revisit later.
- Managed databases, object storage, etc.

## Prior Art / Competitors

- **Coolify** - single-server focused, Docker-based, good UI
- **Kubero** - k8s-native, needs "a good Claude once over" per Fuzzy
- **CapRover** - older, Docker Swarm based
- **Dokku** - Heroku-like, single server, CLI-only

## Key Differentiators

- Actually polished UX (the gap in all existing tools)
- Works on both single-node Docker and multi-node k8s
- Open source, community-driven

## Notes

- Fuzzy has already built most of this infrastructure for the jazure cluster (Cloudflare Tunnels, k8s, custom hostname routing). This project would be packaging that into a standalone, reusable tool.
- Not trying to sell it. Goal is a notable open-source project that gets real traction.
- Homelab community is very active and growing.
