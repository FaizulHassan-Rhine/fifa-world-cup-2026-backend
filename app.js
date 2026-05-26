import express from "express"
import cors from "cors"
import { isDbReady } from "./db.js"
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

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      db: isDbReady(),
      message: isDbReady()
        ? "API and database ready"
        : "API up; waiting for MongoDB…",
    })
  })

  app.use("/api", apiRoutes)

  return app
}
