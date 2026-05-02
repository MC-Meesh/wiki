# Wiki App — Setup Instructions

You are helping a user set up their personal wiki. This is a Next.js app that connects to a git-backed markdown wiki repo.

## Setup (first run)

If `.env` does not exist, do the following:

1. Ask the user for two things:
   - Their wiki repo URL (e.g. `https://github.com/username/wiki.git`) — if they don't have one, tell them to create a repo from https://github.com/MC-Meesh/llm-wiki-template and paste the URL
   - A GitHub personal access token with `repo` scope — if they don't have one, send them to https://github.com/settings/tokens/new?scopes=repo

2. Copy `.env.example` to `.env` and fill in:
   - `WIKI_REPO_URL` = their repo URL
   - `GITHUB_TOKEN` = their token
   - `PORT` = 3000 (or ask if they want a different port)
   - Leave all other values as defaults

3. Run `npm install`

4. Run `npm start`

5. Tell the user to open `http://localhost:PORT` in their browser.

## Already configured

If `.env` exists, just run `npm start` and tell the user the app is running.

## Notes

- Never commit `.env` — it contains credentials
- The wiki data is cloned automatically on first `npm start` into `./wiki-data/`
- To deploy instead of running locally, see the README
