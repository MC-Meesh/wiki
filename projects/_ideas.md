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
- **Sub-Token Prediction LLMs** — train a language model whose generation target is abbreviated/partial representations (e.g. first character or first BPE token of each word) rather than full sequences, then reconstruct full text in a second pass. The core thesis: if a model can predict the right word from just its initial fragment, it has learned strong word-level priors and contextual constraints. This compresses the autoregressive sequence length dramatically (potentially 3-5x fewer steps), which directly reduces inference latency since transformer cost scales with sequence length. Two-stage architecture: (1) a "skeleton" model that predicts compressed fragments, (2) a lightweight expander that reconstructs full tokens — the expander could be parallel since fragments are mostly independent. Could also serve as a training signal — partial-token prediction as an auxiliary loss might improve sample efficiency by forcing the model to commit to word identity earlier. **Largely novel as of 2025** — no published work proposes this exact framing. Adjacent work:
  - *Abbreviation expansion* ([NAACL 2022](https://aclanthology.org/2022.naacl-main.91/), [2023 fine-tuning paper](https://arxiv.org/html/2312.14327v1)) — LLMs can reconstruct full sentences from first-letter abbreviations (reverse direction, validates feasibility)
  - *Multi-Token Prediction* ([Meta FAIR 2024](https://arxiv.org/abs/2404.19737)) — predict N future tokens simultaneously, but full tokens
  - *Skeleton-of-Thought* ([ICLR 2024](https://arxiv.org/abs/2307.15337)) — generate outline first, expand in parallel (closest in spirit)
  - *MrT5 / SpaceByte* — dynamic token merging/compression at byte level, not abbreviation level
  - *Speculative decoding* (EAGLE, Medusa) — draft models predict full tokens, not fragments

## Reference
- Karpathy's LLM wiki pattern: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
