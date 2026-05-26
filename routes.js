import { Router } from "express"
import { getDb, isDbReady } from "./db.js"
import { computeGroupStandings } from "./standings.js"
import { gradePrediction, pointsForGrade } from "./scoring.js"

const router = Router()

router.use((req, res, next) => {
  if (isDbReady()) return next()
  res.status(503).json({
    error:
      "Database not connected yet. Check MONGODB_URI in .env.local and your internet.",
  })
})

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
}

function isAdmin(req) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.headers["x-admin-key"] === secret
}

router.get("/matches/:matchNumber", async (req, res) => {
  try {
    const matchNumber = Number(req.params.matchNumber)
    if (!Number.isFinite(matchNumber)) {
      return res.status(400).json({ error: "Invalid match number" })
    }

    const db = getDb()
    const [result, predictions] = await Promise.all([
      db.collection("match_results").findOne({ matchNumber }),
      db
        .collection("predictions")
        .find({ matchNumber })
        .sort({ createdAt: 1 })
        .toArray(),
    ])

    const final = result?.finalScore ?? null
    const finished = Boolean(result?.finished)

    const list = predictions.map((p) => {
      const grade =
        finished && final
          ? gradePrediction(p.homeGoals, p.awayGoals, final.home, final.away)
          : null
      return {
        id: p._id.toString(),
        name: p.name,
        homeGoals: p.homeGoals,
        awayGoals: p.awayGoals,
        createdAt: p.createdAt,
        grade,
        points: grade ? pointsForGrade(grade) : 0,
      }
    })

    res.json({
      matchNumber,
      finished,
      finalScore: final,
      predictions: list,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to load match" })
  }
})

router.post("/matches/:matchNumber/predictions", async (req, res) => {
  try {
    const matchNumber = Number(req.params.matchNumber)
    const name = normalizeName(req.body?.name)
    const homeGoals = Number(req.body?.homeGoals)
    const awayGoals = Number(req.body?.awayGoals)

    if (!Number.isFinite(matchNumber)) {
      return res.status(400).json({ error: "Invalid match number" })
    }
    if (!name || name.length < 2) {
      return res.status(400).json({ error: "Name must be at least 2 characters" })
    }
    if (
      !Number.isInteger(homeGoals) ||
      !Number.isInteger(awayGoals) ||
      homeGoals < 0 ||
      awayGoals < 0 ||
      homeGoals > 20 ||
      awayGoals > 20
    ) {
      return res.status(400).json({ error: "Scores must be whole numbers 0–20" })
    }

    const db = getDb()
    const finished = await db
      .collection("match_results")
      .findOne({ matchNumber, finished: true })
    if (finished) {
      return res.status(400).json({ error: "Match is finished — predictions closed" })
    }

    const doc = {
      matchNumber,
      name,
      nameLower: name.toLowerCase(),
      homeGoals,
      awayGoals,
      createdAt: new Date(),
    }

    await db.collection("predictions").updateOne(
      { matchNumber, nameLower: doc.nameLower },
      { $set: doc },
      { upsert: true },
    )

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to save prediction" })
  }
})

router.post("/matches/:matchNumber/result", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Admin key required" })
    }

    const matchNumber = Number(req.params.matchNumber)
    const homeGoals = Number(req.body?.homeGoals)
    const awayGoals = Number(req.body?.awayGoals)
    const group = req.body?.group ?? null
    const phase = req.body?.phase ?? "group"
    const home = req.body?.home
    const away = req.body?.away

    if (!Number.isFinite(matchNumber)) {
      return res.status(400).json({ error: "Invalid match number" })
    }
    if (
      !Number.isInteger(homeGoals) ||
      !Number.isInteger(awayGoals) ||
      homeGoals < 0 ||
      awayGoals < 0
    ) {
      return res.status(400).json({ error: "Invalid final score" })
    }

    const db = getDb()
    await db.collection("match_results").updateOne(
      { matchNumber },
      {
        $set: {
          matchNumber,
          group,
          phase,
          home: home ?? null,
          away: away ?? null,
          finalScore: { home: homeGoals, away: awayGoals },
          finished: true,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    )

    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to set result" })
  }
})

router.get("/standings/groups", async (_req, res) => {
  try {
    const db = getDb()
    const matches = await db
      .collection("match_results")
      .find({ finished: true, phase: "group", group: { $ne: null } })
      .toArray()

    res.json({ groups: computeGroupStandings(matches) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to load group standings" })
  }
})

router.get("/standings/predictors", async (_req, res) => {
  try {
    const db = getDb()
    const [predictions, results] = await Promise.all([
      db.collection("predictions").find({}).toArray(),
      db.collection("match_results").find({ finished: true }).toArray(),
    ])

    const finalByMatch = new Map(
      results.map((r) => [r.matchNumber, r.finalScore]),
    )

    /** @type {Record<string, { name: string, points: number, exact: number, outcome: number, played: number }>} */
    const byName = {}

    for (const p of predictions) {
      const final = finalByMatch.get(p.matchNumber)
      if (!final) continue

      const key = p.nameLower
      if (!byName[key]) {
        byName[key] = {
          name: p.name,
          points: 0,
          exact: 0,
          outcome: 0,
          played: 0,
        }
      }
      const grade = gradePrediction(
        p.homeGoals,
        p.awayGoals,
        final.home,
        final.away,
      )
      byName[key].played += 1
      byName[key].points += pointsForGrade(grade)
      if (grade === "exact") byName[key].exact += 1
      if (grade === "outcome") byName[key].outcome += 1
    }

    const leaderboard = Object.values(byName).sort(
      (a, b) => b.points - a.points || b.exact - a.exact || a.name.localeCompare(b.name),
    )

    res.json({ leaderboard })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Failed to load predictor standings" })
  }
})

export default router
