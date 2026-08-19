import app from "./app";
import { logger } from "./lib/logger";
import { clearDevSessions } from "./lib/devAuth";
import { startUploadSweep } from "./lib/uploadSweep";
import { startVideoPurge } from "./lib/videoPurge";
import { startVideoIntegrityCheck } from "./lib/videoIntegrityCheck";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Ping the DB every 4 minutes so the Neon endpoint never suspends in production.
// Neon's default idle timeout is 5 minutes; staying under that keeps the
// endpoint active and prevents "endpoint disabled" errors on the next deploy.
function startDbKeepalive(): void {
  const INTERVAL_MS = 4 * 60 * 1000;
  const ping = (): void => {
    pool.query("SELECT 1").catch((err: unknown) => {
      logger.warn({ err }, "DB keepalive ping failed");
    });
  };
  ping(); // wake immediately on startup
  setInterval(ping, INTERVAL_MS);
  logger.info("DB keepalive started (4 min interval)");
}

async function start(): Promise<void> {
  startUploadSweep();
  startVideoPurge();
  startVideoIntegrityCheck();
  startDbKeepalive();
  // In development the app starts signed out: clear stale sessions before we
  // accept traffic so the very first request can't race ahead of the wipe.
  if (process.env.NODE_ENV === "development") {
    await clearDevSessions();
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void start();
