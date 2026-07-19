import fs from 'fs';
import OpenAI from 'openai';
import buildingsData from '../src/data/buildings_scored.json' with { type: 'json' };
import { getTopN } from '../src/lib/ranking.js';
import { explainBuilding } from '../src/lib/explain.js';

const OUTPUT_PATH = new URL('../src/data/explanations.json', import.meta.url);

// Same client pattern as src/lib/explain.js — reads OPENAI_API_KEY from env.
const client = new OpenAI();

/**
 * Coordinator agent — takes the #1 pick from Medical and the #1 pick from
 * Machinery (plus their already-generated reasoning) and reasons about how
 * the two teams should sequence their work. This is the orchestration step:
 * it doesn't re-rank anything, it reconciles two rankings that already,
 * provably, disagree.
 */
async function generateCoordinatorSynthesis(medicalTop, machineryTop) {
  const prompt = `Two response coordinators are working the same disaster zone.

Medical (EMS/Search & Rescue) top priority: Building ${medicalTop.id}, ${medicalTop.damage}.
Their reasoning: "${medicalTop.reason}"

Machinery (Heavy Equipment) top priority: Building ${machineryTop.id}, ${machineryTop.damage}.
Their reasoning: "${machineryTop.reason}"

In 2-3 sentences, recommend how these two teams should sequence their work given both priorities. Be concrete about whether they can act independently or need to coordinate.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 120,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0].message.content.trim();
}

async function generateAllExplanations() {
  const medical = getTopN(buildingsData, "medical", 5);
  const machinery = getTopN(buildingsData, "machinery", 5);

  const jobs = [
    ...medical.map((b) => ({ b, view: "medical" })),
    ...machinery.map((b) => ({ b, view: "machinery" })),
  ];

  const explanations = {};
  const failed = [];

  for (const { b, view } of jobs) {
    const key = `${view}_${b.id}`;
    try {
      explanations[key] = await explainBuilding(b, view);
      console.log(`OK ${key}: ${explanations[key]}`);
    } catch (err) {
      console.error(`FAIL ${key}: ${err.message}`);
      explanations[key] = null;
      failed.push(key);
    }
  }

  // Coordinator synthesis — runs after the top-5 explanations above, reusing
  // the #1 medical/machinery picks and the explanations already generated
  // for them (falls back to a generic string if either one failed).
  try {
    const medicalTop1 = medical[0];
    const machineryTop1 = machinery[0];
    const medicalReason = explanations[`medical_${medicalTop1.id}`] || "No explanation available.";
    const machineryReason = explanations[`machinery_${machineryTop1.id}`] || "No explanation available.";

    const coordinatorText = await generateCoordinatorSynthesis(
      { id: medicalTop1.id, damage: medicalTop1.damage, reason: medicalReason },
      { id: machineryTop1.id, damage: machineryTop1.damage, reason: machineryReason }
    );
    explanations["coordinator"] = coordinatorText;
    console.log(`OK coordinator: ${coordinatorText}`);
  } catch (err) {
    console.error(`FAIL coordinator: ${err.message}`);
    explanations["coordinator"] = null;
    failed.push("coordinator");
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(explanations, null, 2));
  console.log(`\nWrote ${Object.keys(explanations).length} entries to src/data/explanations.json`);
  if (failed.length) {
    console.log(`${failed.length} failed and are null - rerun to retry:`, failed);
  }
}

generateAllExplanations();
