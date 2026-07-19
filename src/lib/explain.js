import OpenAI from 'openai';

const client = new OpenAI();

export async function explainBuilding(building, view) {
  const actorContext = view === "medical"
    ? "a search-and-rescue/EMS dispatcher deciding which building to send the next team to, out of many damaged buildings"
    : "a heavy equipment coordinator deciding where to send a crane or excavator next, out of a fleet that is too small to cover every damaged building";

  const prompt = view === "medical"
    ? `You are helping ${actorContext}. A building has damage level "${building.damage}". ` +
      `Treat "Destroyed" as the highest-urgency case (occupants may be trapped and need immediate extraction), "Damaged" as moderate urgency, and "Possibly damaged" as lower urgency needing assessment. ` +
      `Do not speculate about whether occupants could have survived or whether the building is worth searching — always frame more severe damage as more urgent to reach, not less. ` +
      `In one short sentence, explain why this building would or would not be a priority for this responder. Be concrete, no fluff, no preamble.`
    : `You are helping ${actorContext}. A building has damage level "${building.damage}" and a machinery priority score of ${building.machinery_score}, ` +
      `where higher scores mean the building sits in a denser cluster of nearby damage (one crane deployment clears more sites), and lower scores mean it is more isolated (a deployment here only helps one site). ` +
      `Write the explanation so its tone matches how high or low this score actually is — do not describe a low-scoring, isolated building as urgent or high-priority. ` +
      `In one short sentence, explain why this building would or would not be a priority for this responder. Be concrete, no fluff, no preamble.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 60,
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content.trim();
}
