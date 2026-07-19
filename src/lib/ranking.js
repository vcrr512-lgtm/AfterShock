export function getRanked(buildings, view) {
  const scoreKey = view === "medical" ? "medical_score" : view === "machinery" ? "machinery_score" : null;

  if (!scoreKey) {
    return [...buildings];
  }

  return [...buildings].sort((a, b) => {
    const scoreA = a[scoreKey];
    const scoreB = b[scoreKey];

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    return a.id - b.id;
  });
}
