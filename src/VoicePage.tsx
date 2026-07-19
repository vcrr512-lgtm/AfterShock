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
import { getRanked } from "./lib/ranking.js";

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

function getScoreColor(building: Building, view: "medical" | "machinery") {
  const key = view === "medical" ? "medical_score" : "machinery_score";
  const allScores = BUILDINGS.map((candidate) => candidate[key]);
  const min = Math.min(...allScores);
  const max = Math.max(...allScores);
  const t = (building[key] - min) / (max - min || 1);
  const r = Math.round(100 + t * 155);
  const g = Math.round(100 - t * 100);
  const b = Math.round(100 - t * 100);
  return `rgb(${r},${g},${b})`;
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
            <DomMarkers
              buildings={sortedBuildings}
              selectedId={selectedId}
              onSelect={(building: any) => setSelectedId(building.id)}
              getColor={(building: any) => getScoreColor(building, activeView)}
            />
          </div>
        </Spatialized2DElementContainer>

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
      </div>
    </div>
  );
}
