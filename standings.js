/**
 * Build group standings from finished group-stage match results.
 * @param {Array<{ group: string, home: { code: string }, away: { code: string }, finalScore: { home: number, away: number } }>} matches
 */
export function computeGroupStandings(matches) {
  /** @type {Record<string, Record<string, { played: number, gf: number, ga: number, gd: number, pts: number }>>} */
  const tables = {}

  for (const m of matches) {
    if (!m.group || !m.finalScore) continue
    const { home: h, away: a } = m.finalScore
    const homeCode = m.home?.code
    const awayCode = m.away?.code
    if (!homeCode || !awayCode) continue

    if (!tables[m.group]) tables[m.group] = {}
    const g = tables[m.group]
    for (const code of [homeCode, awayCode]) {
      if (!g[code]) g[code] = { played: 0, gf: 0, ga: 0, gd: 0, pts: 0 }
    }

    g[homeCode].played += 1
    g[awayCode].played += 1
    g[homeCode].gf += h
    g[homeCode].ga += a
    g[awayCode].gf += a
    g[awayCode].ga += h

    if (h > a) {
      g[homeCode].pts += 3
    } else if (h < a) {
      g[awayCode].pts += 3
    } else {
      g[homeCode].pts += 1
      g[awayCode].pts += 1
    }
  }

  for (const group of Object.keys(tables)) {
    for (const code of Object.keys(tables[group])) {
      const row = tables[group][code]
      row.gd = row.gf - row.ga
    }
  }

  return tables
}
