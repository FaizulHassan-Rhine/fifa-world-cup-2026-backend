import express from "express"
import cors from "cors"
import { ensureDbConnected, getMongoStatus, isDbReady } from "./db.js"
import { proxyFootballRequest } from "./footballProxy.js"
import apiRoutes from "./routes.js"

export function createApp() {
  const app = express()

  const corsOrigin = process.env.CORS_ORIGIN
  app.use(
    cors({
      origin: corsOrigin
        ? corsOrigin.split(",").map((s) => s.trim())
        : true,
      credentials: true,
    }),
  )
  app.use(express.json())

  app.get("/api/health", async (_req, res) => {
    if (!isDbReady()) {
      try {
        await ensureDbConnected()
      } catch {
        /* reported below */
      }
    }

    const status = getMongoStatus()
    res.json({
      ok: true,
      db: isDbReady(),
      mongoEnvSet: Boolean(process.env.MONGODB_URI),
      apiFootballKeySet: Boolean(process.env.API_FOOTBALL_KEY),
      mongoState: status.state,
      mongoLastError: status.lastError,
      message: isDbReady()
        ? "API and database ready"
        : "API up; waiting for MongoDB…",
    })
  })

  app.all(/^\/api\/football(\/.*)?$/, async (req, res) => {
    try {
      const suffix = req.path.replace(/^\/api\/football/, "") || "/"
      const query = req.url.includes("?")
        ? req.url.slice(req.url.indexOf("?"))
        : ""
      const upstreamPath = suffix + query
      const { status, body, contentType } = await proxyFootballRequest(upstreamPath)
      res.status(status).type(contentType).send(body)
    } catch (e) {
      console.warn("[football-proxy]", e)
      res.status(502).json({ error: "Football API proxy failed" })
    }
  })

  app.use("/api", apiRoutes)

  return app
}
