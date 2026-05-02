#!/usr/bin/env node
/**
 * create-llm-wiki — interactive setup CLI
 *
 * Usage:
 *   npx create-llm-wiki
 *
 * What it does:
 *   1. GitHub device flow → stores token
 *   2. Creates wiki repo from llm-wiki-template on your account
 *   3. Clones llm-wiki app locally
 *   4. Writes .env
 *   5. Runs npm install && npm start
 */

import { createInterface } from "readline";
import { execSync, spawnSync } from "child_process";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";

const GITHUB_CLIENT_ID = "Ov23lihLUtcZQXFRHl1B"; // llm-wiki OAuth App (device flow)
const TEMPLATE_REPO = "MC-Meesh/llm-wiki-template";
const APP_REPO = "MC-Meesh/llm-wiki";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function main() {
  console.log("\n🌿 llm-wiki setup\n");

  // Step 1: GitHub device flow
  console.log("Step 1/4  GitHub authentication");
  const deviceRes = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: "repo" }),
  }).then((r) => r.json());

  console.log(`\n  Open: ${deviceRes.verification_uri}`);
  console.log(`  Code: ${deviceRes.user_code}\n`);

  // Poll for token
  let token = null;
  const interval = (deviceRes.interval ?? 5) * 1000;
  process.stdout.write("  Waiting for approval");
  while (!token) {
    await new Promise((r) => setTimeout(r, interval));
    process.stdout.write(".");
    const poll = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceRes.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    }).then((r) => r.json());

    if (poll.access_token) token = poll.access_token;
    else if (poll.error === "access_denied") {
      console.error("\n  Cancelled.");
      process.exit(1);
    }
  }
  console.log("\n  Authenticated.\n");

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  const user = await fetch("https://api.github.com/user", {
    headers: ghHeaders,
  }).then((r) => r.json());
  const username = user.login;

  // Step 2: Create wiki repo from template
  console.log("Step 2/4  Creating your wiki repo");
  const wikiName = (await ask(`  Repo name [wiki]: `)).trim() || "wiki";
  const wikiRepoFullName = `${username}/${wikiName}`;

  const existing = await fetch(
    `https://api.github.com/repos/${wikiRepoFullName}`,
    { headers: ghHeaders }
  );
  let wikiUrl;
  if (existing.ok) {
    wikiUrl = (await existing.json()).clone_url;
    console.log(`  Using existing repo: ${wikiUrl}`);
  } else {
    const created = await fetch(
      `https://api.github.com/repos/${TEMPLATE_REPO}/generate`,
      {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ owner: username, name: wikiName, private: true }),
      }
    ).then((r) => r.json());
    wikiUrl = created.clone_url;
    console.log(`  Created: ${wikiUrl}`);
  }

  // Step 3: LLM provider
  console.log("\nStep 3/4  LLM provider");
  console.log("  1) claude-cli  (Claude Code installed locally)");
  console.log("  2) anthropic   (Anthropic API key)");
  console.log("  3) openai      (OpenAI API key)");
  console.log("  4) ollama      (local Ollama instance)");
  const providerChoice = (await ask("  Choice [1]: ")).trim() || "1";
  const providerMap = {
    "1": "claude-cli",
    "2": "anthropic",
    "3": "openai",
    "4": "ollama",
  };
  const provider = providerMap[providerChoice] ?? "claude-cli";

  let apiKey = "";
  if (provider === "anthropic" || provider === "openai") {
    apiKey = (await ask(`  API key: `)).trim();
  }

  const port = (await ask("\n  Port [3000]: ")).trim() || "3000";

  // Step 4: Clone app + write .env
  console.log("\nStep 4/4  Installing llm-wiki");
  const installDir = join(process.cwd(), "llm-wiki");
  if (!existsSync(installDir)) {
    console.log(`  Cloning into ./llm-wiki ...`);
    spawnSync("git", ["clone", `https://github.com/${APP_REPO}.git`, "llm-wiki"], {
      stdio: "inherit",
    });
  }

  const authedWikiUrl = wikiUrl.replace(
    "https://",
    `https://x-access-token:${token}@`
  );

  const env = [
    `WIKI_REPO_URL=${wikiUrl}`,
    `WIKI_PATH=./wiki-data`,
    `GITHUB_TOKEN=${token}`,
    `LLM_PROVIDER=${provider}`,
    apiKey ? `LLM_API_KEY=${apiKey}` : "",
    `PORT=${port}`,
    `TZ=America/Denver`,
    `RECONCILE_CRON=0 7 * * *`,
    `SYNC_INTERVAL_MS=60000`,
    `WEBHOOK_SECRET=${Math.random().toString(36).slice(2)}`,
    `SKIP_AUTH=true`,
  ]
    .filter(Boolean)
    .join("\n");

  writeFileSync(join(installDir, ".env"), env + "\n");
  console.log("  .env written.");

  rl.close();

  console.log("\n  Running npm install...");
  spawnSync("npm", ["install"], { cwd: installDir, stdio: "inherit" });

  console.log(`\nDone. Start your wiki:\n`);
  console.log(`  cd llm-wiki && npm start\n`);
  console.log(`  Then open http://localhost:${port}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
