/**
 * VoicePage — Main damage dashboard using real scored building data.
 *
 * DIAGNOSTIC BUILD: panel source order deliberately swapped from the last
 * version. dispatch-status-panel and about-panel now occupy the 3rd/4th
 * position (where buildings-panel and detail-panel used to be — the only
 * two panels that have successfully spatialized in every prior test).
 * buildings-panel and detail-panel are now 5th/6th.
 *
 * Visual layout is UNCHANGED — grid-column/grid-row placement is done via
 * CSS class selectors, not source order, so this reorder only matters for
 * testing whether WebSpatial's spatial promotion depends on DOM position.
 */

import buildingsData from "./data/buildings_scored.json";
import explanationsData from "./data/explanations.json";
import { useEffect, useMemo, useState } from "react";
import { Spatialized2DElementContainer } from "@webspatial/react-sdk";
import DomMarkers from "./DomMarkers";
import DamageMap from "./DamageMap";
import { getRanked } from "./lib/ranking.js";

const USE_3D_MAP = true;

const SEVERE_MMI_THRESHOLD = 8.0;

type DamageCategory = "Medical" | "Machinery";
type DispatchStatus = "pending" | "dispatched" | "cleared";

type Building = {
  id: number;
  lat: number;
  lon: number;
  damage: "Possibly damaged" | "Damaged" | "Destroyed";
  medical_score: number;
  machinery_score: number;
  shakemap_mmi_min: number;
};

const CATEGORIES: { key: DamageCategory; label: string }[] = [
  { key: "Medical", label: "EMS / Search & Rescue Dispatch" },
  { key: "Machinery", label: "Heavy Equipment Coordinator" },
];

const BUILDINGS = buildingsData as Building[];

const SEVERITY_COUNTS = BUILDINGS.reduce((acc, b) => {
  acc[b.damage] = (acc[b.damage] ?? 0) + 1;
  return acc;
}, {} as Record<Building["damage"], number>);

const SEVERE_ZONE_COUNT = BUILDINGS.filter((b) => b.shakemap_mmi_min >= SEVERE_MMI_THRESHOLD).length;

function getScoreColor(building: Building) {
  switch (building.damage) {
    case "Destroyed":
      return "#ef4444";
    case "Damaged":
      return "#f97316";
    case "Possibly damaged":
      return "#eab308";
    default:
      return "#9ca3af";
  }
}

function isSevereZone(building: Building) {
  return building.shakemap_mmi_min >= SEVERE_MMI_THRESHOLD;
}

const STATUS_LABELS: Record<DispatchStatus, string> = {
  pending: "Pending",
  dispatched: "Dispatched",
  cleared: "Cleared",
};

export default function VoicePage() {
  const [activeCategory, setActiveCategory] = useState<DamageCategory>("Medical");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<Record<number, DispatchStatus>>({});

  const activeView = activeCategory.toLowerCase() as "medical" | "machinery";
  const activeScoreKey = activeView === "medical" ? "medical_score" : "machinery_score";

  const sortedBuildings = useMemo(() => {
    return getRanked(BUILDINGS, activeView) as (Building & { rank: number })[];
  }, [activeCategory]);

  useEffect(() => {
    setSelectedId(sortedBuildings[0]?.id ?? null);
  }, [sortedBuildings]);

  const selectedBuilding = sortedBuildings.find((building) => building.id === selectedId) ?? null;
  const explanationKey = selectedBuilding ? `${activeView}_${selectedBuilding.id}` : null;
  const explanation = explanationKey
    ? (explanationsData[explanationKey as keyof typeof explanationsData] as string | undefined)
    : undefined;

  const currentStatus: DispatchStatus = selectedBuilding
    ? dispatchStatus[selectedBuilding.id] ?? "pending"
    : "pending";

  // Coordinator synthesis — reconciles Medical's and Machinery's #1 picks.
  // Not tied to activeCategory: it covers both views at once, so it stays
  // visible no matter which persona toggle is selected.
  const coordinatorText = explanationsData["coordinator" as keyof typeof explanationsData] as
    | string
    | undefined;

  function setStatusForSelected(status: DispatchStatus) {
    if (!selectedBuilding) return;
    setDispatchStatus((prev) => ({ ...prev, [selectedBuilding.id]: status }));
  }

  const topRanked = sortedBuildings.slice(0, 12);

  return (
    <div className="dashboard-root">
      <header className="dashboard-header">
        <h1>Damage Dashboard</h1>
        <p className="dashboard-subtitle">Caraballeda, La Guaira, Venezuela — Building Damage Overview</p>
      </header>

      <div className="stats-row">
        <div className="stat-card severity-destroyed">
          <span className="stat-value">{SEVERITY_COUNTS["Destroyed"] ?? 0}</span>
          <span className="stat-label">Destroyed</span>
        </div>
        <div className="stat-card severity-damaged">
          <span className="stat-value">{SEVERITY_COUNTS["Damaged"] ?? 0}</span>
          <span className="stat-label">Damaged</span>
        </div>
        <div className="stat-card severity-possible">
          <span className="stat-value">{SEVERITY_COUNTS["Possibly damaged"] ?? 0}</span>
          <span className="stat-label">Possibly Damaged</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{SEVERE_ZONE_COUNT}</span>
          <span className="stat-label">In Severe Shaking Zone</span>
        </div>
      </div>

      {/* ── Coordination panel: reconciles Medical + Machinery's top picks ──
          Placed above dashboard-main / the Dispatch Mode toggle and outside
          the sidebar — covers both persona views at once, so it stays
          visible regardless of which one is active, no click required. ── */}
      <Spatialized2DElementContainer
        ref={null}
        component="section"
        data-spatial-id="coordinator-panel"
        className="dashboard-panel coordinator-panel"
      >
        <div className="panel-heading">
          <h2>Coordination</h2>
          <p>How Medical and Machinery should sequence their top priorities.</p>
        </div>
        <p className="detail-text">
          {coordinatorText ?? "Coordinator recommendation unavailable — rerun npm run generate-explanations."}
        </p>
      </Spatialized2DElementContainer>

      <div className="dashboard-main">
        {/* Slot 1 */}
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

        {/* Slot 2 */}
        <Spatialized2DElementContainer
          ref={null}
          component="section"
          data-spatial-id="ranked-list-panel"
          className="dashboard-panel ranked-panel"
        >
          <div className="panel-heading">
            <h2>Top Priorities</h2>
            <p>{activeCategory} view — ranked for {activeView === "medical" ? "life-safety response" : "clearance impact"}.</p>
          </div>
          <div className="ranked-header">
            <span>#</span>
            <span></span>
            <span>Building</span>
            <span>Score</span>
            <span>Zone</span>
            <span>Status</span>
          </div>
          <div className="ranked-list">
            {topRanked.map((building, index) => {
              const status = dispatchStatus[building.id] ?? "pending";
              return (
                <button
                  key={building.id}
                  type="button"
                  className={`ranked-row${building.id === selectedId ? " selected" : ""}`}
                  onClick={() => setSelectedId(building.id)}
                >
                  <span className="ranked-position">{index + 1}</span>
                  <span className="ranked-dot" style={{ backgroundColor: getScoreColor(building) }} />
                  <span className="ranked-id">BLDG {building.id}</span>
                  <span className="ranked-score">{building[activeScoreKey]}</span>
                  <span className="ranked-zone">{isSevereZone(building) ? "Yes" : "No"}</span>
                  <span className={`ranked-status ranked-status-${status}`}>
                    {status === "pending" ? "—" : STATUS_LABELS[status]}
                  </span>
                </button>
              );
            })}
          </div>
        </Spatialized2DElementContainer>

        {/* Slot 3 — was buildings-panel (working). Now dispatch-status-panel. */}
        <Spatialized2DElementContainer
          ref={null}
          component="aside"
          data-spatial-id="dispatch-status-panel"
          className="detail-panel dispatch-status-panel"
        >
          <h2>Dispatch Status</h2>
          <div className="status-button-row">
            {(["pending", "dispatched", "cleared"] as DispatchStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                disabled={!selectedBuilding}
                className={`status-button status-${status}${currentStatus === status ? " active" : ""}`}
                onClick={() => setStatusForSelected(status)}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </Spatialized2DElementContainer>

        {/* Slot 4 — was detail-panel (working). Now about-panel. */}
        <Spatialized2DElementContainer
          ref={null}
          component="aside"
          data-spatial-id="about-ranking-panel"
          className="detail-panel about-panel"
        >
          <h2>About This Ranking</h2>
          <p className="detail-text">
            Medical scoring uses only three severity values — Destroyed = 3, Damaged = 2, Possibly damaged = 1 —
            independent of neighboring buildings.
          </p>
          <p className="detail-text">
            Machinery scoring multiplies severity by local damage density within a 150m radius, so a Damaged
            building inside a dense cluster can outrank an isolated Destroyed one.
          </p>
        </Spatialized2DElementContainer>

        {/* Slot 5 — was slot 3 (buildings-panel). Moved here to test position vs identity. */}
        <Spatialized2DElementContainer
          ref={null}
          component="section"
          data-spatial-id="building-grid-panel"
          className="dashboard-panel buildings-panel"
        >
          <div className="map-overlay-topleft">
            {sortedBuildings.length} scored buildings • {activeCategory} focus
          </div>
          <div className="map-legend-badge">
            <span className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: "#ef4444" }} />
              Destroyed
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: "#f97316" }} />
              Damaged
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: "#eab308" }} />
              Possibly damaged
            </span>
          </div>
          <div className="scene-shell">
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
          <div className="map-caption">M7.5 mainshock • Copernicus EMSR884 • USGS ShakeMap</div>
        </Spatialized2DElementContainer>

        {/* Slot 6 — was slot 4 (detail-panel). Moved here to test position vs identity. */}
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
                <strong>Severe shaking zone:</strong> {isSevereZone(selectedBuilding) ? "Yes" : "No"}
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

      <footer className="dashboard-footer">
        Last updated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
        {" "}• Sources: Copernicus EMSR884, USGS ShakeMap, WebSpatial VANTAGE prototype
      </footer>
    </div>
  );
}