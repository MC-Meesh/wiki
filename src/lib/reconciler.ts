import { readFile, writeFile, rename, mkdir, readdir } from "fs/promises";
import { join } from "path";
import simpleGit from "simple-git";

const WIKI_PATH = process.env.WIKI_PATH || "/tmp/wiki";

const TZ = process.env.TZ || "America/Denver";

function getDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function getDayOfWeek(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: TZ });
}

export async function reconcileDaily(): Promise<string> {
  const now = new Date();
  const today = getDateStr(now);
  // Subtract one calendar day
  const yesterdayDate = new Date(now.toLocaleDateString("en-CA", { timeZone: TZ }));
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  const log: string[] = [];

  const dailyDir = join(WIKI_PATH, "daily");
  const archiveDir = join(WIKI_PATH, "daily", "archive");

  // Ensure archive dir exists
  await mkdir(archiveDir, { recursive: true });

  // Read yesterday's file
  const yesterdayPath = join(dailyDir, `${yesterday}.md`);
  let yesterdayContent: string | null = null;
  try {
    yesterdayContent = await readFile(yesterdayPath, "utf-8");
  } catch {
    log.push(`No daily file for ${yesterday}, skipping carry-forward.`);
  }

  // Build set of item texts ever completed in the archive. Guards against
  // stale [ ] items from incorrectly-generated daily files propagating
  // indefinitely — if an item was ever marked [x] on any day, it's done.
  const everCompleted = new Set<string>();
  try {
    const archiveFiles = await readdir(archiveDir);
    for (const fname of archiveFiles) {
      if (!fname.endsWith(".md")) continue;
      const content = await readFile(join(archiveDir, fname), "utf-8");
      for (const line of content.split("\n")) {
        const m = line.match(/^(\s*)-\s+\[x\]\s+(.*)$/i);
        if (m) {
          const text = m[2].replace(/\s*\(from [^)]+\)\s*$/, "").trim();
          everCompleted.add(text.toLowerCase());
        }
      }
    }
  } catch {
    // archive dir missing — non-fatal
  }

  const incomplete: string[] = [];

  if (yesterdayContent) {
    // Extract incomplete todos, skipping anything already completed historically
    const lines = yesterdayContent.split("\n");
    for (const line of lines) {
      const match = line.match(/^(\s*)-\s+\[ \]\s+(.*)$/);
      if (match) {
        const raw = match[2].trim();
        // Preserve original (from DATE) so age is visible; only add if missing
        const item = /\(from \d{4}-\d{2}-\d{2}\)$/.test(raw)
          ? `- [ ] ${raw}`
          : `- [ ] ${raw} (from ${yesterday})`;
        const bare = raw.replace(/\s*\(from [^)]+\)\s*$/, "").trim();
        if (!everCompleted.has(bare.toLowerCase())) {
          incomplete.push(item);
        }
      }
    }

    // Update frontmatter to done
    const updated = yesterdayContent.replace(
      /^(---\n[\s\S]*?status:\s*)(?:active|pending)/m,
      "$1done"
    );
    await writeFile(yesterdayPath, updated, "utf-8");

    // Move to archive
    const archivePath = join(archiveDir, `${yesterday}.md`);
    try {
      await rename(yesterdayPath, archivePath);
      log.push(`Archived ${yesterday}.md → archive/`);
    } catch {
      log.push(`Could not archive ${yesterday}.md (may already be archived)`);
    }
  }

  // Read or create today's file
  const todayPath = join(dailyDir, `${today}.md`);
  let todayContent: string | null = null;
  try {
    todayContent = await readFile(todayPath, "utf-8");
  } catch {
    // doesn't exist yet
  }

  if (!todayContent) {
    // Create fresh daily file
    const dayName = getDayOfWeek(now);
    const parts = [
      "---",
      `date: ${today}`,
      "status: active",
      "---",
      `# ${today} (${dayName})`,
      "",
      "## Focus",
      "",
    ];

    if (incomplete.length > 0) {
      parts.push("## Carried Forward");
      parts.push(...incomplete);
      parts.push("");
    }

    parts.push("## Notes", "");
    todayContent = parts.join("\n");
    await writeFile(todayPath, todayContent, "utf-8");
    log.push(
      `Created ${today}.md with ${incomplete.length} carried-forward items.`
    );
  } else {
    // Today exists — append any new carried-forward items not already present
    let added = 0;
    for (const item of incomplete) {
      const text = item.replace(/^- \[ \] /, "").replace(/ \(from .*\)$/, "");
      if (!todayContent.includes(text)) {
        todayContent += `\n${item}`;
        added++;
      }
    }
    if (added > 0) {
      await writeFile(todayPath, todayContent, "utf-8");
      log.push(`Added ${added} new carried-forward items to ${today}.md`);
    } else {
      log.push(`${today}.md already up to date.`);
    }
  }

  // Git commit + push
  const git = simpleGit(WIKI_PATH);
  await git.add("-A");
  const status = await git.status();
  if (status.files.length > 0) {
    await git.commit(`reconciler: daily rollover ${today}`);
    await git.push("origin", "main").catch(() => {});
    log.push(`Committed and pushed changes.`);
  } else {
    log.push(`No changes to commit.`);
  }

  return log.join("\n");
}
