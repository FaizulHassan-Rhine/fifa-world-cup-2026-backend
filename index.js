import "./env.js"
import { createApp } from "./app.js"
import { connectDb, closeDb, isDbReady } from "./db.js"

const PORT = Number(process.env.PORT) || 3001
const RETRY_MS = 10_000
const app = createApp()

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function connectWithRetry(maxAttempts = null) {
  let attempts = 0
  while (!isDbReady() && (maxAttempts == null || attempts < maxAttempts)) {
    attempts++
    try {
      await connectDb()
      console.log("[api] MongoDB connected")
      return
    } catch (err) {
      const hint =
        err?.code === "ECONNREFUSED" && String(err?.syscall) === "querySrv"
          ? "\n[api] Tip: DNS blocked SRV lookup. Use a standard mongodb:// URI from Atlas."
          : ""
      console.error(`[api] MongoDB failed: ${err.message}${hint}`)
      console.error(`[api] Retrying in ${RETRY_MS / 1000}s…`)
      await sleep(RETRY_MS)
    }
  }

  if (!isDbReady()) {
    console.error(
      `[api] MongoDB connection failed after ${
        maxAttempts == null ? "unlimited attempts" : `${maxAttempts} attempts`
      }`,
    )
  }
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[api] Prediction API on http://localhost:${PORT}`)
    console.log(`[api] Football proxy: http://localhost:${PORT}/api/football/fixtures`)
    void connectWithRetry(null)
  })

  process.on("SIGINT", async () => {
    await closeDb()
    process.exit(0)
  })
} else {
  // Vercel cold start: do a few retries so allowlist propagation/network hiccups
  // won't permanently keep the app in db:false.
  void connectWithRetry(5)
}

export default app
