/**
 * Next.js instrumentation hook — runs once on server startup.
 * Kicks off the background scheduler (git sync + daily reconciler).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler.js");
    startScheduler();
  }
}
