---
title: Project & Startup Ideas Backlog
created: 2026-04-12
updated: 2026-04-12
tags: [projects, ideas, backlog]
---
# Project & Startup Ideas Backlog

Running list of ideas. When one gets serious, promote it to its own `projects/<name>.md`.

---

## Marketing & Content
- **Marketing AI Agent** — finds relevant subreddits/communities for promotion
- **Daily Dose AI** — internet content aggregator with proper citations
- **Content Automation** — AI-generated Reddit posts, YouTube shorts, TikToks, long-form videos
- **Personalized Newsletter** — summaries tailored to user interests
- **Video Uploader** — automated posting across TikTok, YouTube, Instagram
- **ScrapR** — scrape trending product leads from TikTok, X, Meta, etc.
- **Postguide** — short-form article content to support creators

## Agent Infrastructure
- **Discord MCP** — MCP server so Claude can read/write Discord DMs + channels. Originally pitched for agent-to-agent coordination between chase's and james's Claudes, but the llm-wiki shared-workspace design (see `personal-wiki.md`) covers that use case more cleanly — structured notes + handoff files in a shared repo beats ephemeral chat for async collab. Discord MCP value drops to: (a) letting Claude triage/summarize Discord for me like Gmail, (b) posting status updates to a channel, (c) reading community servers for signal. Still useful, lower priority. Reconsider once llm-wiki multi-workspace is live.

## Developer Tools
- **Security Code Review Agent** — AI-powered code security audits
- **TDD Validator** — AI for test-driven development and LLM app validation
- **Easy RAG** — open-source, plug-and-play Retrieval-Augmented Generation setup
- **AI Autocorrect** — context-aware typing correction with undo/indicator
- **Easy Passkey** — passkey auth made simple for developers (one/few line solution)
- **Building In Public Buddy** — tracks Claude/git commits, generates tweets about what you did and learned
- **Supakeepr** — periodically writes updates to Supabase to prevent project hibernation
- **System Diagram → LLM Implementation Plan** — feed it an architecture diagram, get a step-by-step build plan
- **"Ghost"** — CUA helper that allows Claude CUA without interfering with current processes

## Finance & Markets
- **Super VC** — in-progress (details TBD)
- **Real Estate Demand Tracker** — uses median days-to-rent as proxy for market demand
- **Mental Math App** — mental math training/practice

## Lifestyle & Services
- **Life Tutor** — enforces productivity by "bricking" distractions if tasks aren't done
- **Uber for Seniors** — on-demand rides, prescription delivery, and services
- **Karaoke AI** — converts any song into MIDI/DAW-compatible segments for karaoke/remixes
- **Tech Neck Correction** — iOS sensor data for posture correction
- **Posture Camera Tool** — camera-based posture feedback
- **Podcast with Uber Customers** — free rides in exchange for podcast content

## Robotics / Hardware
- **Edge Device Glasses** — ML models on personalized hardware
- **Smart Bathroom Mirror** — one-way mirror with screen behind it, programmable display (weather, calendar, news, etc.)

## Crypto / Web3
- **Prathik's Energy NFTs** — pay agents in energy NFTs

## Research / ML
- **Sub-Token Prediction LLMs** — next-token prediction where the model only sees/predicts a sub-word fragment (e.g. first token of each word) rather than full BPE tokens. Could enable faster inference via shorter sequences, force the model to learn stronger word-level priors, or serve as a compression/distillation technique. Explore whether partial-token supervision produces useful representations or competitive generation quality.

## Reference
- Karpathy's LLM wiki pattern: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
