import "./env.js"
import { createApp } from "./app.js"
import { connectDb, closeDb, isDbReady } from "./db.js"

const PORT = Number(process.env.PORT) || 3001
const RETRY_MS = 10_000
const app = createApp()

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function connectWithRetry() {
  while (!isDbReady()) {
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
      if (process.env.VERCEL) return
      console.error(`[api] Retrying in ${RETRY_MS / 1000}s…`)
      await sleep(RETRY_MS)
    }
  }
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[api] Prediction API on http://localhost:${PORT}`)
    void connectWithRetry()
  })

  process.on("SIGINT", async () => {
    await closeDb()
    process.exit(0)
  })
} else {
  void connectDb().catch((err) => {
    console.error("[api] MongoDB failed on cold start:", err.message)
  })
}

export default app
