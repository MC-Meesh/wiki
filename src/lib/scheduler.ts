/**
 * Background scheduler — runs the git sync loop and daily reconciler
 * inside the Node process so no shell wrapper or Docker entrypoint is needed.
 */

import cron from "node-cron";
import simpleGit from "simple-git";
import { reconcileDaily } from "./reconciler";

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  const WIKI_PATH = process.env.WIKI_PATH ?? "/tmp/wiki";
  const SYNC_INTERVAL_MS = parseInt(
    process.env.SYNC_INTERVAL_MS ?? "60000",
    10
  );
  const RECONCILE_CRON = process.env.RECONCILE_CRON ?? "0 7 * * *";
  const TZ = process.env.TZ ?? "America/Denver";

  // Git sync loop: pull then push on an interval
  const syncOnce = async () => {
    const git = simpleGit(WIKI_PATH);
    try {
      await git.fetch("origin", "main");
      await git.rebase(["origin/main"]).catch(async () => {
        await git.rebase(["--abort"]).catch(() => {});
        await git.stash();
        await git.reset(["--hard", "origin/main"]);
        await git.stash(["pop"]).catch(() => {});
      });
      await git.push("origin", "main").catch(() => {});
    } catch {
      // non-fatal — will retry next interval
    }
  };

  setInterval(syncOnce, SYNC_INTERVAL_MS);
  console.log(`[scheduler] git sync every ${SYNC_INTERVAL_MS / 1000}s`);

  // Daily reconciler cron
  cron.schedule(
    RECONCILE_CRON,
    async () => {
      console.log("[scheduler] running daily reconciler");
      try {
        const log = await reconcileDaily();
        console.log("[scheduler] reconciler done:", log);
      } catch (err) {
        console.error("[scheduler] reconciler error:", err);
      }
    },
    { timezone: TZ }
  );

  console.log(
    `[scheduler] daily reconciler scheduled: ${RECONCILE_CRON} (${TZ})`
  );
}
