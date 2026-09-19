import { createClient } from "redis";

/**
 * Shared redis connection.
 *
 * This module used to be a top-level `await createClient().connect()`, which
 * meant an unreachable redis took the whole server down at import time — no
 * login screen, no camera list, nothing, for a dependency most screens do not
 * need. Now the client is exported immediately and connects in the
 * background, retrying with a backoff. Features that need redis fail on their
 * own call ("The client is closed") and recover as soon as it comes back.
 */
const REDIS_URL = process.env.REDIS_URL || undefined;

const client = createClient({
  url: REDIS_URL,
  socket: {
    // Give up nothing: a redis restart should heal by itself.
    reconnectStrategy: (retries: number) => Math.min(1000 * 2 ** Math.min(retries, 5), 30000),
  },
});

client.on("error", (err) => console.error("[redis] client error:", err?.message ?? err));
client.on("ready", () => console.log("[redis] connected"));

async function connectWithRetry(): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await client.connect();
      return;
    } catch (err: any) {
      const wait = Math.min(1000 * 2 ** Math.min(attempt, 5), 30000);
      console.error(
        `[redis] connection attempt ${attempt} failed (${err?.message ?? err}); ` +
        `retrying in ${wait / 1000}s. Features that need redis stay unavailable until then.`,
      );
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

void connectWithRetry();

export default client;
