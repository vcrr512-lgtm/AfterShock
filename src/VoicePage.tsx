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
import type { SpatializedElement } from "@webspatial/core-sdk";
import { useEffect, useMemo, useState } from "react";
import { SpatializedContainer } from "@webspatial/react-sdk";

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

const damageColor = (damage: Building["damage"]) => {
  switch (damage) {
    case "Destroyed":
      return "#f56565";
    case "Damaged":
      return "#f6ad55";
    case "Possibly damaged":
      return "#63b3ed";
    default:
      return "#a0aec0";
  }
};

export default function VoicePage() {
  const [activeCategory, setActiveCategory] = useState<DamageCategory>("Medical");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const activeScoreKey = activeCategory === "Medical" ? "medical_score" : "machinery_score";

  const sortedBuildings = useMemo(() => {
    return [...BUILDINGS].sort((a, b) => {
      const scoreA = a[activeScoreKey];
      const scoreB = b[activeScoreKey];
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.id - b.id;
    });
  }, [activeCategory, activeScoreKey]);

  useEffect(() => {
    setSelectedId(sortedBuildings[0]?.id ?? null);
  }, [sortedBuildings]);

  const selectedBuilding = sortedBuildings.find((building) => building.id === selectedId) ?? null;
  const topScore = sortedBuildings[0]?.[activeScoreKey] ?? 0;

  return (
    <div className="dashboard-root">
      <header className="dashboard-header">
        <div>
          <h1>Damage Dashboard</h1>
          <p className="dashboard-subtitle">Building damage overview for WebSpatial.</p>
        </div>
      </header>

      <div className="dashboard-panel-grid">
        <SpatializedContainer
          component="section"
          spatializedContent="div"
          createSpatializedElement={() => Promise.resolve({} as SpatializedElement)}
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
        </SpatializedContainer>

        <SpatializedContainer
          component="section"
          spatializedContent="div"
          createSpatializedElement={() => Promise.resolve({} as SpatializedElement)}
          data-spatial-id="building-grid-panel"
          className="dashboard-panel buildings-panel"
        >
          <div className="panel-heading">
            <h2>Building Priorities</h2>
            <p>{sortedBuildings.length} scored buildings • {activeCategory} focus</p>
          </div>

          <div className="damage-grid">
            {sortedBuildings.map((building) => {
              const score = building[activeScoreKey];
              const isTop = score === topScore;
              const isSelected = selectedId === building.id;
              return (
                <button
                  key={building.id}
                  type="button"
                  className={`dot-card${isSelected ? " selected" : ""}${isTop ? " top-ranked" : ""}`}
                  style={{
                    backgroundColor: damageColor(building.damage),
                    borderColor: isTop ? "#facc15" : "transparent",
                  }}
                  onClick={() => setSelectedId(building.id)}
                >
                  <div className="dot-card-label">ID {building.id}</div>
                  <div className="dot-card-damage">{building.damage}</div>
                  <div className="dot-card-score">{`Score ${score}`}</div>
                </button>
              );
            })}
          </div>
        </SpatializedContainer>

        <SpatializedContainer
          component="aside"
          spatializedContent="div"
          createSpatializedElement={() => Promise.resolve({} as SpatializedElement)}
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
            </>
          ) : (
            <p className="detail-text">Select a building to view its actual score and damage grade.</p>
          )}
        </SpatializedContainer>
      </div>
    </div>
  );
}
