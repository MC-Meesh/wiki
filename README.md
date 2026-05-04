# wiki

**Self-hosted AI wiki, managed by Claude.**

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![npm](https://img.shields.io/npm/v/create-wiki)](https://www.npmjs.com/package/create-wiki)

Your AI assistant reads and writes a git-backed markdown wiki every session: capturing todos, notes, projects, and goals. Changes sync automatically across devices. Access it anywhere via the web UI.

---

## Setup

```bash
npx create-wiki
```

Runs an interactive wizard: GitHub auth, creates your wiki repo, writes `.env`, installs, and starts the app. Done in two minutes.

<details>
<summary>Claude / LLM setup (clone and paste your repo URL)</summary>

```bash
git clone https://github.com/MC-Meesh/wiki.git
cd wiki
claude  # or any Claude Code session pointed at this directory
```

Claude reads `CLAUDE.md` and walks you through the rest. Paste your wiki repo URL and a GitHub token when asked.

</details>

<details>
<summary>curl | bash (no npx required)</summary>

```bash
curl -fsSL https://raw.githubusercontent.com/MC-Meesh/wiki/main/setup.sh | bash
```

</details>

<details>
<summary>Manual install</summary>

```bash
git clone https://github.com/MC-Meesh/wiki.git
cd wiki
cp .env.example .env   # fill in WIKI_REPO_URL and GITHUB_TOKEN
npm install
npm start
```

</details>

---

## Features

- **Claude-powered:** Claude Code reads wiki files, writes todos, captures notes, and runs tools
- **Git-backed:** your wiki is a plain markdown repo you own, cloned from [wiki-template](https://github.com/MC-Meesh/llm-wiki-template)
- **Daily todos:** automatic morning carry-forward with original dates preserved
- **Web UI:** mobile-friendly, works on any device
- **Self-hosted:** Railway, Vercel, Render, [Mortise](https://github.com/mortise-org/mortise), or just `npm start` locally

---

## Configuration

All config lives in `.env`. See [`.env.example`](.env.example) for the full reference.

| Variable | Default | Description |
|----------|---------|-------------|
| `WIKI_REPO_URL` | required | Your wiki repo, created by the setup wizard |
| `GITHUB_TOKEN` | required | Token with `repo` scope for git push/pull |
| `SKIP_AUTH` | `true` | Disable login for single-user deployments |
| `TZ` | `America/Denver` | Timezone for daily file naming and reconciler |
| `RECONCILE_CRON` | `0 7 * * *` | Cron for the daily todo carry-forward |
| `CLAUDE_CREDS_JSON` | optional | Base64-encoded Claude credentials for server deployments |

---

## Deploying

### Railway / Vercel / Render / [Mortise](https://github.com/mortise-org/mortise)

Push your fork to GitHub. The platform auto-detects Next.js. Set the env vars in the dashboard and point the start command to `npm start`.

### Local

```bash
npm start        # production
npm run dev      # dev mode with hot reload
```

---

## Wiki template

Your wiki repo is created from [wiki-template](https://github.com/MC-Meesh/llm-wiki-template). It contains:

- `CLAUDE.md`: AI instructions loaded as system context every session
- `daily/`: daily task files with automatic carry-forward
- `projects/`, `goals/`, `notes/`, `inbox/`, `personal/`: structured folders

Customize `CLAUDE.md` to match how you think and what you track.

---

## Sync

Changes made via the web UI are committed and pushed immediately. Local devices pull on a configurable interval (default: 60s). For instant push-to-pull sync, set up a GitHub webhook pointing to `https://your-host/api/webhook` with your `WEBHOOK_SECRET`.

---

## License

MIT
