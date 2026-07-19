import OpenAI from 'openai';

const client = new OpenAI();

// Flags a mismatch between a building's damage grade and its ShakeMap
// shaking-intensity band. Only the two cases the team asked for:
//   - "Damaged" (not worse) despite sitting in the higher 8.0 band
//   - "Destroyed" despite sitting in the lower 7.5 band
// Deliberately narrow — do not extend to "Possibly damaged" cases or
// other thresholds without checking that the signal actually holds up
// (grid resolution vs. AOI size makes near-boundary bands noisy).
function shakemapDisagreementNote(building) {
  const mmi = building.shakemap_mmi_min;
  if (mmi == null) return '';

  const disagrees =
    (building.damage === 'Damaged' && mmi >= 8.0) ||
    (building.damage === 'Destroyed' && mmi <= 7.5);

  if (!disagrees) return '';

  return (
    `\n\nThis building's USGS ShakeMap shaking-intensity band is MMI ${mmi.toFixed(1)}, ` +
    `which is higher/lower than you'd expect given its damage grade ("${building.damage}"). ` +
    `Add exactly one additional short sentence flagging this as worth a closer look — ` +
    `do not claim the damage grade is wrong, do not speculate about why the mismatch exists, ` +
    `just note that it diverges from the shaking-intensity pattern. ` +
    `Your total response should now be two short sentences instead of one.`
  );
}

export async function explainBuilding(building, view) {
  const actorContext = view === "medical"
    ? "a search-and-rescue/EMS dispatcher deciding which building to send the next team to, out of many damaged buildings"
    : "a heavy equipment coordinator deciding where to send a crane or excavator next, out of a fleet that is too small to cover every damaged building";

  const basePrompt = view === "medical"
    ? `You are helping ${actorContext}. A building has damage level "${building.damage}". ` +
      `Treat "Destroyed" as the highest-urgency case (occupants may be trapped and need immediate extraction), "Damaged" as moderate urgency, and "Possibly damaged" as lower urgency needing assessment. ` +
      `Do not speculate about whether occupants could have survived or whether the building is worth searching — always frame more severe damage as more urgent to reach, not less. ` +
      `In one short sentence, explain why this building would or would not be a priority for this responder. Be concrete, no fluff, no preamble.`
    : `You are helping ${actorContext}. A building has damage level "${building.damage}" and a machinery priority score of ${building.machinery_score}, ` +
      `where higher scores mean the building sits in a denser cluster of nearby damage (one crane deployment clears more sites), and lower scores mean it is more isolated (a deployment here only helps one site). ` +
      `Write the explanation so its tone matches how high or low this score actually is — do not describe a low-scoring, isolated building as urgent or high-priority. ` +
      `In one short sentence, explain why this building would or would not be a priority for this responder. Be concrete, no fluff, no preamble.`;

  const prompt = basePrompt + shakemapDisagreementNote(building);

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    // was 60 — bumped because the shakemap note can add a second sentence,
    // and 60 tokens was already tight for one sentence.
    max_tokens: 90,
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content.trim();
}

// Exported for testing/inspection without hitting the API.
export { shakemapDisagreementNote };