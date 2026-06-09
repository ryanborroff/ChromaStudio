import app from "./app";
import { logger } from "./lib/logger";
import { clearDevSessions } from "./lib/devAuth";

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

async function start(): Promise<void> {
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
