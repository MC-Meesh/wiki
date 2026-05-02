#!/usr/bin/env node
/**
 * Start script — clones the wiki repo on first run, then starts Next.js.
 * Replaces the Docker entrypoint so no container runtime is needed.
 */

import { execSync, spawn } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";

const WIKI_PATH = process.env.WIKI_PATH ?? "/tmp/wiki";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const WIKI_REPO_URL = process.env.WIKI_REPO_URL;
const isDev = process.argv.includes("--dev");

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}

// Clone wiki repo if not present
if (!existsSync(join(WIKI_PATH, ".git"))) {
  if (!WIKI_REPO_URL) {
    console.error(
      "Error: WIKI_REPO_URL is not set. Run `npm run setup` first."
    );
    process.exit(1);
  }
  const cloneUrl = GITHUB_TOKEN
    ? WIKI_REPO_URL.replace("https://", `https://x-access-token:${GITHUB_TOKEN}@`)
    : WIKI_REPO_URL;
  console.log(`Cloning wiki from ${WIKI_REPO_URL}...`);
  run(`git clone "${cloneUrl}" "${WIKI_PATH}"`);
  run(`git config user.email "llm-wiki@localhost"`, { cwd: WIKI_PATH });
  run(`git config user.name "llm-wiki"`, { cwd: WIKI_PATH });
  if (GITHUB_TOKEN) {
    const authedUrl = WIKI_REPO_URL.replace(
      "https://",
      `https://x-access-token:${GITHUB_TOKEN}@`
    );
    run(`git remote set-url origin "${authedUrl}"`, { cwd: WIKI_PATH });
  }
  console.log("Wiki cloned.");
} else {
  console.log("Wiki already present, pulling latest...");
  try {
    run(`git pull --rebase origin main`, { cwd: WIKI_PATH });
  } catch {
    // non-fatal on first start
  }
}

// Write Claude Code credentials if provided (optional)
if (process.env.CLAUDE_CREDS_JSON) {
  const credsDir = join(process.env.HOME ?? "/tmp", ".claude");
  run(`mkdir -p "${credsDir}"`);
  writeFileSync(
    join(credsDir, ".credentials.json"),
    Buffer.from(process.env.CLAUDE_CREDS_JSON, "base64").toString("utf-8"),
    { mode: 0o600 }
  );
}

// Start Next.js (scheduler starts inside the app via instrumentation hook)
const nextCmd = isDev ? "next dev" : "next start";
console.log(`Starting llm-wiki (${isDev ? "dev" : "production"})...`);
const [bin, ...args] = nextCmd.split(" ");
const child = spawn(bin, args, { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
