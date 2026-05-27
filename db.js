import { MongoClient } from "mongodb"

let client
let db
let ready = false
let lastMongoError = null
/** @type {'idle' | 'connecting' | 'ready' | 'failed'} */
let connectState = "idle"
/** @type {Promise<import("mongodb").Db> | null} */
let connectPromise = null

export function isDbReady() {
  return ready
}

export function getMongoLastError() {
  const msg =
    lastMongoError instanceof Error
      ? lastMongoError.message
      : String(lastMongoError || "")
  return msg ? msg.slice(0, 240) : null
}

export function getMongoStatus() {
  return {
    state: ready ? "ready" : connectState,
    lastError: getMongoLastError(),
  }
}

export async function connectDb() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("MONGODB_URI is not set in environment")
  }

  if (client) {
    await client.close().catch(() => {})
    client = undefined
    db = undefined
    ready = false
  }

  const isVercel = Boolean(process.env.VERCEL)
  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: isVercel ? 20_000 : 12_000,
    // Vercel may need IPv6; forcing IPv4 only can cause timeouts.
    ...(isVercel ? {} : { family: 4 }),
  })

  try {
    await client.connect()
    db = client.db()
    await db.collection("predictions").createIndex(
      { matchNumber: 1, nameLower: 1 },
      { unique: true },
    )
    await db.collection("match_results").createIndex(
      { matchNumber: 1 },
      { unique: true },
    )
    ready = true
    connectState = "ready"
    lastMongoError = null
    return db
  } catch (err) {
    lastMongoError = err
    ready = false
    connectState = "failed"
    try {
      await client.close().catch(() => {})
    } catch {
      /* ignore */
    }
    client = undefined
    db = undefined
    throw err
  }
}

/** Connect on demand (required for Vercel serverless — background connect may not run). */
export async function ensureDbConnected() {
  if (ready && db) return db
  if (connectPromise) return connectPromise

  connectState = "connecting"
  connectPromise = connectDb()
    .then((database) => {
      connectState = "ready"
      return database
    })
    .catch((err) => {
      connectState = "failed"
      lastMongoError = err
      throw err
    })
    .finally(() => {
      connectPromise = null
    })

  return connectPromise
}

export function getDb() {
  if (!db || !ready) throw new Error("Database not connected")
  return db
}

export async function closeDb() {
  ready = false
  connectState = "idle"
  connectPromise = null
  if (client) await client.close()
  client = undefined
  db = undefined
}
