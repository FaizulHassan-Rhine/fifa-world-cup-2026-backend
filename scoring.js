/** @returns {'exact' | 'outcome' | 'wrong'} */
export function gradePrediction(predHome, predAway, finalHome, finalAway) {
  if (predHome === finalHome && predAway === finalAway) return "exact"
  const predDiff = predHome - predAway
  const finalDiff = finalHome - finalAway
  if (predDiff === 0 && finalDiff === 0) return "outcome"
  if (predDiff > 0 && finalDiff > 0) return "outcome"
  if (predDiff < 0 && finalDiff < 0) return "outcome"
  return "wrong"
}

export function pointsForGrade(grade) {
  if (grade === "exact") return 3
  if (grade === "outcome") return 1
  return 0
}
