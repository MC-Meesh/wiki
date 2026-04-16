---
title: Personal Website + Blog
created: 2026-04-12
updated: 2026-04-12
status: active
tags: [project, website, blog, career]
repo: MC-Meesh/Portfolio3
---
# Personal Website + Blog

Rebuild personal site with a blog showcasing technical depth. Current site is Astro (Portfolio3) — want to move off Astro to something simpler.

## Goals
- Clean, minimal personal site with projects + resume
- Blog with technical writeups that demonstrate ML/engineering depth
- Easy to publish new posts (markdown-based)
- Good for career visibility (interviews, networking, LinkedIn content)

## Tech Stack (TBD)
- [ ] Pick framework — Next.js, SvelteKit, Hugo, or plain MDX?
- [ ] Hosting — Vercel, Cloudflare Pages, or GitHub Pages
- [ ] Domain — mc-allen.tech (already owned, Hostinger), or new?

## Blog Backlog

### Ready to Write (have the experience/code)
- [ ] **PCA Reconstruction of SDFs** — reconstructing signed distance fields using principal component analysis. Visual-heavy, good for showing math + code + 3D renders.
- [ ] **PINNs vs Transolver Architecture** — comparison of physics-informed neural networks vs transformer-based solvers. Architecture diagrams, training dynamics, accuracy tradeoffs.
- [ ] **3D Convolutional Networks with Variable Inputs** — handling variable-size 3D data in CNNs. Padding strategies, attention mechanisms, practical implementation.
- [ ] **Engineering Datatypes Project** — custom data structures for engineering/scientific computing. Type safety, performance, ergonomics.

### Neural / implicit representations (sequel posts to "What is an SDF?")
- [ ] **Neural SDFs: fitting an MLP to a single shape** — the simplest case. Train a tiny MLP on (point, distance) pairs sampled from a target SDF. Network weights ARE the shape. Memory and differentiability story. Live training visualization in the browser.
- [ ] **DeepSDF and learned shape spaces** — one network trained over a family of shapes with per-shape latent codes. Latent space arithmetic for shape morphing/interpolation. Maps to autoencoder intuition.
- [ ] **NeRF: the same trick for scenes** — same per-scene-overfit pattern, but the network outputs color+density for radiance field rendering instead of distance. Volume rendering vs sphere tracing.
- [ ] **From DeepSDF to operator learning** — when does the "function approximator" view (DeepSDF) blend into "operator learning" (FNO)? What's actually different between a conditional INR and a neural operator?
- [ ] **Why neural implicit reps for ML** — the case for SDFs/NeRFs over meshes/voxels in ML pipelines. Differentiability, smooth gradients, compact storage, plug-and-play with downstream losses. Comparison with marching-cubes-on-voxels approaches.

### Brainstorm (could develop into posts)
- [ ] **Agent Orchestration with Gas Town** — how I built a multi-agent system for personal productivity. Architecture, lessons learned, what works and what doesn't.
- [ ] **Building a Personal Finance Pipeline** — SimpleFIN + Beancount + Claude. Automating financial tracking with plain-text accounting.
- [ ] **Claude Code as a Daily Driver** — using Claude Code for everything from email triage to wiki management. Workflow, hooks, MCP integrations.
- [ ] **ML at Neural Concept** — what working on simulation/CAE ML looks like day-to-day (if allowed to share publicly).
- [ ] **CMU Grad School Retrospective** — MechE → ML pipeline, what I'd do differently, what was worth it.
- [ ] **Interview Prep for ML Engineers** — NeetCode + system design + ML theory. The study plan and what actually matters.
- [ ] **SBIR Phase I with Jemba9** — writing a government grant proposal for AI/defense tech. The process, what worked, what to watch out for.
- [ ] **Motorcycle Data Logger** — if applicable, any telemetry/data projects with the R3.
- [ ] **Digital Marketing Pipeline** — building an autonomous cold email system. GillyReach → enrichment → copy generation → sending at scale.

## Blog demo wrapper pattern (locked in 2026-04-13)

Reusable infrastructure for embedding interactive demos inline in blog posts. Clean separation of WebGL/Canvas isolation (iframes) + reusable visual language (shared CSS) + reusable utilities (shared JS module).

### Files
- `public/blog/lib/blog-demo.css` — all styles (`.demo`, `.split-wrap`, `.canvas-col`, `.caption-col`, `.controls`, `.readout`, `.help`, `.err.shown`). Color tokens via CSS vars.
- `public/blog/lib/blog-demo.js` — ES module utilities:
  - `filterDemosByQuery()` — auto-hide demos via `?demo=ID` query param
  - `mapping/w2p/p2w/sdfGradient` — uniform-scale 2D coord helpers
  - `marchingSquares(sdf, level, xRange, yRange, cellsX, emit)` — extract iso-contours
  - `makeCircleTexture(THREE)` — sprite for round Three.js Points
  - `safeRenderer(THREE, canvas, opts?)` — Three.js renderer factory with context-loss handler
  - `autoResize(canvas, renderer, camera)` — keep canvas backing store synced
  - `sdfColor(v, maxAbs)` — sign + magnitude → RGB
  - `pausable(fn)` — wraps a tick fn to bail when tab hidden
  - `demoActive(canvasId)` — IIFE early-return helper
- `public/blog/lib/_template.html` — minimal scaffolding any new post starts from
- `public/blog/_test-wrapper.html` + `content/blog/_test-wrapper.md` — stress-test post (filename underscore-prefix + `draft: true` keep it out of `/blog`)

### How to add a new interactive blog post
1. Copy `lib/_template.html` → `public/blog/MY-POST.html`
2. Each demo: a `<div class="demo" data-demo="ID">` with whatever layout and an IIFE
3. IIFE starts with `if (!demoActive('canvas-id')) return;`
4. Create `content/blog/MY-POST.md` with frontmatter (no `standalone` field)
5. Embed inline: `<iframe src="/blog/MY-POST.html?demo=ID" style="..." />`
6. Iframe heights are hand-tuned per demo (FIXME: future build a `<DemoEmbed>` React component that auto-measures via postMessage)

### Conventions
- One HTML file per blog post
- Inline `<iframe>` per demo, with `?demo=ID` filter
- WebGL stays out of React (HMR + WebGL = GPU instability) — always iframe
- All-safe Three.js: `THREE.Points`, `MeshStandardMaterial`, no `Data3DTexture`, no custom `ShaderMaterial`
- IBM Plex Mono, black/white/gray palette baked into `:root` of `blog-demo.css`

### Known limitations
- Iframe heights are hand-tuned per embed (manual)
- Each post still loads Three.js separately (could share via service-worker cache)
- No React-side `<DemoEmbed>` wrapper — directly authoring `<iframe>` in markdown

## Future Enhancements (backburner)
- [ ] **Downloadable standalone HTML for blog demos** — for heavy interactive demos (large Three.js scenes, datasets), offer a "download" link so users can save the HTML file and run locally without paying network/iframe overhead. Removed in 2026-04-13 because the mixed iframe-vs-standalone state was a maintenance headache. Re-add cleanly when needed: probably a per-iframe small "↓" affordance, or a single "all demos" zip link in the post header.
- [ ] Syntax highlighting for code blocks via Shiki (SSR, ~100KB, uses VS Code TextMate grammars)
- [ ] Runnable code cells in browser via Pyodide (CPython WASM, ~10MB lazy-load) — numpy/pandas/matplotlib all work. Fits the existing interactive-demo registry pattern (`interactive: PyodideNotebook` in frontmatter). JS/TS trivial via Monaco + iframe eval.

## Milestones
- [ ] Pick tech stack and scaffold site
- [ ] Migrate content from Portfolio3
- [ ] Publish first blog post
- [ ] Share on LinkedIn
