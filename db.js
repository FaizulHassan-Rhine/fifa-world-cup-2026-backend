import { MongoClient } from "mongodb"

let client
let db
let ready = false
let lastMongoError = null

export function isDbReady() {
  return ready
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

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 12_000,
    family: 4,
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
    lastMongoError = null
    return db
  } catch (err) {
    // Store the last error so /api/health can surface it in production.
    lastMongoError = err
    ready = false
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

export function getDb() {
  if (!db || !ready) throw new Error("Database not connected")
  return db
}

export async function closeDb() {
  ready = false
  if (client) await client.close()
  client = undefined
  db = undefined
}

export function getMongoLastError() {
  const msg =
    lastMongoError instanceof Error ? lastMongoError.message : String(lastMongoError || "")
  return msg ? msg.slice(0, 240) : null
}
