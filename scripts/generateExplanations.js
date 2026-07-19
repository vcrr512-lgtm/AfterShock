import fs from 'fs';
import buildingsData from '../src/data/buildings_scored.json' with { type: 'json' };
import { getTopN } from '../src/lib/ranking.js';
import { explainBuilding } from '../src/lib/explain.js';

const OUTPUT_PATH = new URL('../src/data/explanations.json', import.meta.url);

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

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(explanations, null, 2));
  console.log(`\nWrote ${Object.keys(explanations).length} entries to src/data/explanations.json`);
  if (failed.length) {
    console.log(`${failed.length} failed and are null - rerun to retry:`, failed);
  }
}

generateAllExplanations();
