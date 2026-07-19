/**
 * VoicePage — Main damage dashboard using real scored building data.
 *
 * XR mode (PICO standalone):
 *   - Transparent WebSpatial panel
 *   - Opens /history as a secondary spatial scene for details
 *
 * Desktop browser:
 *   - Dark dashboard page with inline detail panel
 */

import buildingsData from "./data/buildings_scored.json";
import explanationsData from "./data/explanations.json";
import { useEffect, useMemo, useState } from "react";
import { Spatialized2DElementContainer } from "@webspatial/react-sdk";
import DomMarkers from "./DomMarkers";
import DamageMap from "./DamageMap"; // from ishani/scene — Phase 1: terrain only, no markers yet
import { getRanked } from "./lib/ranking.js";

// Flip to false to instantly revert to the known-working flat dot view —
// keep this true only once DamageMap is confirmed rendering in the emulator.
const USE_3D_MAP = true;

const HISTORY_WINDOW_NAME = "damage-detail";

type DamageCategory = "Medical" | "Machinery";

type Building = {
  id: number;
  lat: number;
  lon: number;
  damage: "Possibly damaged" | "Damaged" | "Destroyed";
  medical_score: number;
  machinery_score: number;
};

const CATEGORIES: { key: DamageCategory; label: string }[] = [
  { key: "Medical", label: "EMS / Search & Rescue Dispatch" },
  { key: "Machinery", label: "Heavy Equipment Coordinator" },
];

const BUILDINGS = buildingsData as Building[];

function getScoreColor(building: Building) {
  switch (building.damage) {
    case "Destroyed":
      return "#ef4444"; // red — highest severity
    case "Damaged":
      return "#f97316"; // orange — medium severity
    case "Possibly damaged":
      return "#eab308"; // yellow — lowest severity
    default:
      return "#9ca3af"; // grey fallback, shouldn't normally hit
  }
}

export default function VoicePage() {
  const [activeCategory, setActiveCategory] = useState<DamageCategory>("Medical");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const activeView = activeCategory.toLowerCase() as "medical" | "machinery";
  const activeScoreKey = activeView === "medical" ? "medical_score" : "machinery_score";

  const sortedBuildings = useMemo(() => {
    return getRanked(BUILDINGS, activeView) as (Building & { rank: number })[];
  }, [activeCategory]);

  useEffect(() => {
    setSelectedId(sortedBuildings[0]?.id ?? null);
  }, [sortedBuildings]);

  const selectedBuilding = sortedBuildings.find((building) => building.id === selectedId) ?? null;
  const topScore = sortedBuildings[0]?.[activeScoreKey] ?? 0;
  const explanationKey = selectedBuilding ? `${activeView}_${selectedBuilding.id}` : null;
  const explanation = explanationKey
    ? (explanationsData[explanationKey as keyof typeof explanationsData] as string | undefined)
    : undefined;

  return (
    <div className="dashboard-root">
      <header className="dashboard-header">
        <div>
          <h1>Damage Dashboard</h1>
          <p className="dashboard-subtitle">Building damage overview for WebSpatial.</p>
        </div>
      </header>

      <div className="dashboard-panel-grid">
        {/* Panel 1: Dispatch Mode toggle */}
        <Spatialized2DElementContainer
          ref={null}
          component="section"
          data-spatial-id="toggle-panel"
          className="dashboard-panel toggle-panel"
        >
          <div className="panel-heading">
            <h2>Dispatch Mode</h2>
            <p>Switch between Medical and Machinery priorities.</p>
          </div>

          <div className="button-row">
            {CATEGORIES.map((category) => (
              <button
                key={category.key}
                type="button"
                className={`category-button${activeCategory === category.key ? " selected" : ""}`}
                onClick={() => setActiveCategory(category.key)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </Spatialized2DElementContainer>

        {/* Panel 2: Selected Building Details (moved up — was last, now shows without scrolling) */}
        <Spatialized2DElementContainer
          ref={null}
          component="aside"
          data-spatial-id="detail-panel"
          className="detail-panel"
        >
          <h2>Selected Building Details</h2>
          {selectedBuilding ? (
            <>
              <div className="detail-row">
                <strong>ID:</strong> {selectedBuilding.id}
              </div>
              <div className="detail-row">
                <strong>Damage grade:</strong> {selectedBuilding.damage}
              </div>
              <div className="detail-row">
                <strong>{activeCategory} score:</strong> {selectedBuilding[activeScoreKey]}
              </div>
              <div className="detail-row">
                <strong>Lat / Lon:</strong> {selectedBuilding.lat.toFixed(6)}, {selectedBuilding.lon.toFixed(6)}
              </div>
              {explanation ? (
                <div className="detail-row">
                  <strong>Reasoning:</strong>
                  <p className="detail-text">{explanation}</p>
                </div>
              ) : (
                <p className="detail-text">Select a building to view its actual score and damage grade.</p>
              )}
            </>
          ) : (
            <p className="detail-text">Select a building to view its actual score and damage grade.</p>
          )}
        </Spatialized2DElementContainer>

        {/* Panel 3: Building Priorities scatter */}
        <Spatialized2DElementContainer
          ref={null}
          component="section"
          data-spatial-id="building-grid-panel"
          className="dashboard-panel buildings-panel"
        >
          <div className="panel-heading">
            <h2>Building Priorities</h2>
            <p>{sortedBuildings.length} scored buildings • {activeCategory} focus</p>
          </div>

          <div className="scene-shell" style={{ width: "100%", height: 320, minHeight: 320, display: "block", position: "relative" }}>
            {USE_3D_MAP ? (
              <DamageMap
                buildings={sortedBuildings as any}
                mode={activeView}
                onSelectBuilding={(id: number) => setSelectedId(id)}
              />
            ) : (
              <DomMarkers
                buildings={sortedBuildings}
                selectedId={selectedId}
                onSelect={(building: any) => setSelectedId(building.id)}
                getColor={(building: any) => getScoreColor(building)}
              />
            )}
          </div>
        </Spatialized2DElementContainer>
      </div>
    </div>
  );
}