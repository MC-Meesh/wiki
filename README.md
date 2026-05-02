# llm-wiki

Self-hosted AI wiki — a single source of truth across all your devices, managed by any LLM.

Your AI assistant reads and writes a git-backed markdown wiki every session: capturing todos, notes, projects, and goals. Changes sync between your devices automatically. Access it from anywhere via the web UI.

## Features

- **Any LLM** — Claude Code, Anthropic API, OpenAI, or Ollama
- **Git-backed** — your wiki is a plain markdown repo you own
- **Daily todos** — automatic carry-forward with history preserved
- **Web UI** — mobile-friendly, works on any device
- **Self-hosted** — Railway, Mortise, or just `npm start` locally

## Setup

### Option A — npx (recommended)

```bash
npx create-llm-wiki
```

Runs an interactive wizard: GitHub device flow auth, creates your wiki repo, writes `.env`, installs, and starts the app. Done in ~2 minutes.

### Option B — curl

```bash
curl -fsSL https://raw.githubusercontent.com/MC-Meesh/llm-wiki/main/setup.sh | bash
```

Same wizard, no npx required.

### Option C — manual

```bash
git clone https://github.com/MC-Meesh/llm-wiki.git
cd llm-wiki
cp .env.example .env   # fill in WIKI_REPO_URL and GITHUB_TOKEN
npm install
npm start
```

## Configuration

All config lives in `.env`. See [`.env.example`](.env.example) for the full reference.

Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `WIKI_REPO_URL` | — | Your wiki repo (created from [llm-wiki-template](https://github.com/MC-Meesh/llm-wiki-template)) |
| `GITHUB_TOKEN` | — | Token with `repo` scope for git push/pull |
| `LLM_PROVIDER` | `claude-cli` | `claude-cli` \| `anthropic` \| `openai` \| `ollama` |
| `LLM_API_KEY` | — | Required for `anthropic` and `openai` providers |
| `SKIP_AUTH` | `true` | Disable login for single-user self-hosted |
| `TZ` | `America/Denver` | Timezone for daily file naming and reconciler |
| `RECONCILE_CRON` | `0 7 * * *` | When to run the daily todo reconciler |

## Deploying

### Railway / Mortise / any Node host

Push your fork to GitHub. The platform auto-detects Next.js. Set the env vars in the platform dashboard and point `START_COMMAND` to `npm start`.

### Local

```bash
npm start        # production
npm run dev      # dev mode with hot reload
```

## Wiki template

Your wiki repo is created from [llm-wiki-template](https://github.com/MC-Meesh/llm-wiki-template). It contains:

- `AGENT.md` — AI instructions loaded as system context every session
- `daily/` — daily task files with automatic carry-forward
- `projects/`, `goals/`, `notes/`, `inbox/`, `personal/` — structured folders

Customize `AGENT.md` to match how you think and what you track.

## Sync

Changes made via the web UI are committed and pushed to GitHub immediately. Your local devices pull on a configurable interval (default: 60s). For instant local → server sync, configure a [GitHub webhook](https://docs.github.com/en/webhooks) pointing to `https://your-host/api/webhook` with your `WEBHOOK_SECRET`.

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
