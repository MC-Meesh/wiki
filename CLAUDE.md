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

## Personalizing the app

**To change colors, fonts, spacing, or any visual style:** edit `src/styles/theme.css`. That file contains every design token as a CSS custom property with comments explaining each one. Change values there — nothing else needs to touch.

**To change layout or structure:** edit the relevant component in `src/components/`:
- `shell/MobileShell.tsx` — overall page layout (header, nav, main area)
- `shell/StatusBar.tsx` — top bar
- `shell/BottomNav.tsx` — bottom navigation
- `shell/ChatFAB.tsx` — floating chat button
- `browse/BrowseList.tsx` — file browser
- `daily/QuickAddTodo.tsx` — add-todo input
- `editor/MarkdownEditor.tsx` — wiki editor

Components use plain Tailwind classes. Add, remove, or swap classes freely. You can also add new components and import them into the shell.

**The mental model:** `theme.css` controls how it looks. Component files control how it's structured. Both are plain CSS/Tailwind — no framework to learn.

## Notes

- Never commit `.env` — it contains credentials
- The wiki data is cloned automatically on first `npm start` into `./wiki-data/`
- To deploy instead of running locally, see the README
