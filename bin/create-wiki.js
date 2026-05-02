#!/usr/bin/env node
/**
 * create-wiki — interactive setup CLI
 *
 * Usage: npx create-wiki
 *
 * 1. GitHub device flow → token
 * 2. Create wiki repo from llm-wiki-template
 * 3. Clone wiki app
 * 4. Write .env
 * 5. npm install
 */

import { createInterface } from "readline";
import { spawnSync } from "child_process";
import { writeFileSync, existsSync } from "fs";
import { join } from "path";

const GITHUB_CLIENT_ID = "Ov23lihLUtcZQXFRHl1B";
const TEMPLATE_REPO = "MC-Meesh/llm-wiki-template";
const APP_REPO = "MC-Meesh/wiki";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function deviceFlow() {
  const deviceRes = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: "repo" }),
  }).then((r) => r.json());

  console.log(`\n  Open:  ${deviceRes.verification_uri}`);
  console.log(`  Code:  ${deviceRes.user_code}\n`);

  const interval = (deviceRes.interval ?? 5) * 1000;
  process.stdout.write("  Waiting for approval");

  while (true) {
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

    if (poll.access_token) {
      console.log("\n  Authenticated.\n");
      return poll.access_token;
    }
    if (poll.error === "access_denied") {
      console.error("\n  Cancelled.");
      process.exit(1);
    }
  }
}

async function main() {
  console.log("\nllm-wiki setup\n");

  // Step 1: GitHub auth
  console.log("Step 1/3  GitHub authentication");
  const token = await deviceFlow();

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  const user = await fetch("https://api.github.com/user", { headers: ghHeaders })
    .then((r) => r.json());

  // Step 2: Create wiki repo
  console.log("Step 2/3  Your wiki repo");
  const wikiName = (await ask("  Repo name [wiki]: ")).trim() || "wiki";
  const fullName = `${user.login}/${wikiName}`;

  const existing = await fetch(`https://api.github.com/repos/${fullName}`, {
    headers: ghHeaders,
  });

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
        body: JSON.stringify({ owner: user.login, name: wikiName, private: true }),
      }
    ).then((r) => r.json());
    wikiUrl = created.clone_url;
    console.log(`  Created: ${wikiUrl}`);
  }

  // Step 3: Install
  console.log("\nStep 3/3  Installing");
  const port = (await ask("  Port [3000]: ")).trim() || "3000";
  rl.close();

  const installDir = join(process.cwd(), "llm-wiki");
  if (!existsSync(installDir)) {
    console.log("  Cloning llm-wiki...");
    spawnSync("git", ["clone", `https://github.com/${APP_REPO}.git`, "llm-wiki"], {
      stdio: "inherit",
    });
  }

  const env = [
    `WIKI_REPO_URL=${wikiUrl}`,
    `WIKI_PATH=./wiki-data`,
    `GITHUB_TOKEN=${token}`,
    `PORT=${port}`,
    `TZ=America/Denver`,
    `RECONCILE_CRON=0 7 * * *`,
    `SYNC_INTERVAL_MS=60000`,
    `WEBHOOK_SECRET=${Math.random().toString(36).slice(2)}`,
    `SKIP_AUTH=true`,
  ].join("\n");

  writeFileSync(join(installDir, ".env"), env + "\n");

  spawnSync("npm", ["install"], { cwd: installDir, stdio: "inherit" });

  console.log(`\nDone.\n`);
  console.log(`  cd llm-wiki && npm start`);
  console.log(`  Open http://localhost:${port}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
