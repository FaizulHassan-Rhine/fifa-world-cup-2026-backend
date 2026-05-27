/**
 * Proxies /api/football/* to API-Football (api-sports or RapidAPI).
 * Set API_FOOTBALL_KEY and optional API_FOOTBALL_MODE in .env.local
 */

function getApiKey() {
  return (
    process.env.API_FOOTBALL_KEY ||
    process.env["api-football-v1-pkey"] ||
    ""
  )
}

function getProvider() {
  return (process.env.API_FOOTBALL_MODE || "apisports").toLowerCase()
}

/**
 * @param {string} upstreamPath path + query, e.g. "/fixtures?live=all"
 */
export async function proxyFootballRequest(upstreamPath) {
  const key = getApiKey()
  const provider = getProvider()

  if (!key) {
    return {
      status: 503,
      body: JSON.stringify({
        error:
          "API_FOOTBALL_KEY is not set on the server. Add it to backend/.env.local (local) or Vercel env (production), then restart.",
      }),
      contentType: "application/json",
    }
  }

  let path = upstreamPath.startsWith("/") ? upstreamPath : `/${upstreamPath}`

  if (provider === "rapidapi") {
    if (path.startsWith("/fixtures")) path = "/v3" + path
  } else if (path.startsWith("/v3")) {
    path = path.replace(/^\/v3/, "") || "/"
  }

  const targetBase =
    provider === "apisports"
      ? "https://v3.football.api-sports.io"
      : "https://api-football-v1.p.rapidapi.com"

  const targetUrl = targetBase + path

  /** @type {Record<string, string>} */
  const headers = {}
  if (provider === "apisports") {
    headers["x-apisports-key"] = key
  } else {
    headers["X-RapidAPI-Key"] = key
    headers["X-RapidAPI-Host"] = "api-football-v1.p.rapidapi.com"
  }

  const upstream = await fetch(targetUrl, { method: "GET", headers, redirect: "follow" })
  const ct = upstream.headers.get("content-type") || "application/json"
  const body = await upstream.text()

  return {
    status: upstream.status,
    body,
    contentType: ct,
  }
}
