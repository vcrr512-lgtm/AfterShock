/**
 * ranking.js
 *
 * Single source of truth for building priority rankings across VANTAGE.
 * Ishani, Chloe, and Riya's dashboard should all import from this file
 * instead of writing their own sort logic, so rankings never disagree
 * between what's rendered, what's explained, and what's displayed.
 *
 * Input: an array of building objects (from buildings_scored.json), each
 * shaped like:
 *   { id, lat, lon, damage, medical_score, machinery_score }
 */

/**
 * Returns the full building list, sorted descending by the score for the
 * given view, with a `rank` field (1, 2, 3...) added to each entry.
 *
 * Ties are broken by building id (ascending) so the result is identical
 * every time this is called, by anyone, anywhere in the project.
 *
 * @param {Array<Object>} buildings
 * @param {"medical" | "machinery"} view
 * @returns {Array<Object>} ranked list, each entry = original fields + rank
 */
export function getRanked(buildings, view) {
  const scoreField = view === "medical" ? "medical_score" : "machinery_score";

  const sorted = [...buildings].sort((a, b) => {
    if (b[scoreField] !== a[scoreField]) {
      return b[scoreField] - a[scoreField]; // higher score first
    }
    return a.id - b.id; // tie-break: lower id wins, always deterministic
  });

  return sorted.map((building, index) => ({
    ...building,
    rank: index + 1,
  }));
}

/**
 * Convenience wrapper: returns just the top N entries for a given view.
 *
 * @param {Array<Object>} buildings
 * @param {"medical" | "machinery"} view
 * @param {number} n
 * @returns {Array<Object>} top N ranked entries
 */
export function getTopN(buildings, view, n) {
  return getRanked(buildings, view).slice(0, n);
}