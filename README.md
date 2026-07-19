# AFTER-SHOCK

A post-earthquake resource-allocation prototype built for **Worlds in Action Hack [02] LA — SIGGRAPH Edition**, targeting the Best Agentic Spatial System (PICO) track. Built on real damage and ground-shaking data from the June 2026 Venezuela earthquakes.

**Live demo:** https://after-shock.vercel.app

> This is a concept prototype demonstrating one core mechanic — that different responder roles genuinely disagree about priority, and that reconciling that disagreement is itself a real coordination problem. It is **not** deployed to real responders.

---

## Run it

**Easiest — just open the live link:** https://after-shock.vercel.app
No install required. Works in any modern browser, and inside the PICO Browser on PICO OS 6 / the PICO Emulator (WebSpatial Website Mode — no packaging needed, since PICO OS 6's Web App Runtime includes the WebSpatial Runtime natively).

**To view it inside the PICO Emulator:**
1. Open the PICO Emulator's Browser app.
2. Navigate to `https://after-shock.vercel.app`.
3. Let the page fully load.

**To run it locally instead:**

```bash
git clone https://github.com/vcrr512-lgtm/AfterShock.git
cd AfterShock
npm install
npm run dev
```

Open the printed `http://localhost:5173/` URL.

**To regenerate the AI-generated explanations** (requires an OpenAI API key in a local `.env` file — see `.env.example`):

```bash
npm run generate-explanations
```

---

## What it does

An incident commander toggles between two responder personas looking at the exact same 166 real buildings, and watches the priority ranking genuinely reshuffle:

- **EMS / Search & Rescue Dispatch** — ranks purely by damage severity.
- **Heavy Equipment Coordinator** — ranks by severity weighted against local damage density (a dense cluster of moderate damage can outrank an isolated severe building, since one crane clears more ground there).

These two rankings share **zero overlap** in their top 5 picks — the disagreement is real, computed from real data, not staged.

A third layer, the **Coordinator**, is a separate AI pass that looks at both roles' top picks and reasons about how the two teams should actually sequence their work together — the orchestration step, not just two agents running in parallel.

### Feature list

- Real-time toggle between two scoring models, with the full ranked list and 3D map markers reshuffling live
- Every top-ranked building has a real, AI-generated natural-language explanation for its ranking
- Coordinator panel reconciling both rankings into one sequencing recommendation
- Interactive 3D map: real satellite imagery + real elevation data, colored/scaled markers, orbit and zoom
- Severe-shaking-zone indicator (blue marker ring) computed from real USGS ground-shaking data
- Toggleable real USGS ShakeMap intensity contour overlay
- Fly-through camera mode (WASD / arrow-key controlled low-altitude flight over the terrain)
- Simulated per-building dispatch status tracking (Pending / Dispatched / Cleared)

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| 3D map | MapLibre GL JS |
| Spatial platform | WebSpatial SDK (`@webspatial/react-sdk`), PICO OS 6 |
| AI reasoning | OpenAI `gpt-4o-mini` |
| Styling | Custom CSS design system (Tailwind base only, no utility-class layout) |
| Deployment | Vercel |

---

## How the scoring works

```
Severity weight:   S(b) = { Destroyed: 3, Damaged: 2, Possibly damaged: 1 }

Medical score      = S(b)
                      — pure severity, independent of neighboring buildings.

Machinery score     = S(b) × local clustering density (150m radius)
                      — rewards dense damage pockets over isolated severe
                        buildings, since heavy equipment works a cluster
                        more efficiently than it relocates repeatedly.
```

Confirmed: Medical's #1 pick is Building 93 (Destroyed, isolated). Machinery's #1 pick is Building 20 (Damaged, but in the densest cluster). No overlap in the top 5 between the two views.

---

## Project structure

```
src/
  data/
    buildings_scored.json     166 real buildings — id, lat, lon, damage
                               grade, medical_score, machinery_score,
                               shakemap_mmi_min
    explanations.json         precomputed AI reasoning (top 5 per view)
                               + one Coordinator synthesis entry
    shakemap_lines.json       real USGS ShakeMap contour geometry
  lib/
    ranking.js                shared ranking logic
  scripts/
    generateExplanations.js   generates the AI reasoning + Coordinator text
  VoicePage.tsx                main dashboard — layout, state, all panels
  DamageMap.jsx                the 3D map component
  index.css                    design system + layout
```

---

## Data sources & attribution

- **Building damage data:** Copernicus Emergency Management Service, activation **EMSR884**, AOI12 (Caraballeda, La Guaira, Venezuela), Grading product.
- **Ground-shaking intensity:** **USGS ShakeMap**, event `us6000t7zp`.
- **Satellite basemap:** Esri, Maxar, Earthstar Geographics (World Imagery).
- **Elevation data:** AWS Terrain Tiles (terrarium encoding), public, no API key required.
- **AI-generated reasoning:** OpenAI `gpt-4o-mini`. (The original plan was Claude; substituted due to an API billing issue during the hackathon — disclosed here rather than hidden.)
- **3D map rendering:** MapLibre GL JS.
- **Spatial computing platform:** WebSpatial SDK, running on PICO OS 6.

Responder positions, dispatch status, and task timing are **not** present in the source datasets — those are simulated on top of the real damage and shaking data, for demonstration purposes only.

---

## Known limitations

- **Dispatch status is simulated per browser session only** — it does not persist or sync across devices or users. It demonstrates the concept of "claiming" a site without a real shared backend.
- **Only the top 5 buildings per view have real AI-generated reasoning behind them.** The ranked list is intentionally limited to 5 for this reason.
- **Fly-through camera controls are keyboard-driven** (WASD / arrow keys). This works on desktop and inside the PICO Emulator (which maps keyboard input to controller input), but has no adapter yet for physical PICO hand controllers on real hardware.
- This prototype demonstrates the core two-role-disagreement-plus-reconciliation mechanic only. A full system would additionally model a third Volunteer role, live cross-role deconfliction, time-decayed survival probability, and real-world perturbations (aftershocks, the actual bridge collapse that isolated Caraballeda) — none of which are implemented here.

---

## Team

Built by Riya, Ishani, Chloe, and Valentina for Worlds in Action Hack [02] LA — SIGGRAPH Edition.