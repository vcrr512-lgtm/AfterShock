// App.jsx
// Standalone test harness for SceneMarkers (Step 7 — flat webpage test).
// Riya's WebSpatial wrapper will sit on top of this later.

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import SceneMarkers, { toSceneCoords } from "./SceneMarkers";
import buildingsData from "./data/buildings_scored.json";

// Placeholder coloring — swapped out later for score-based coloring
// driven by whichever persona view (Medical/Machinery) is active.
function placeholderColor(building) {
  if (building.damage === "Destroyed") return "red";
  if (building.damage === "Damaged") return "orange";
  return "yellow"; // Possibly damaged
}

// Pick a starting camera position centered on the densest cluster of
// Destroyed buildings, so the initial view isn't a useless sliver of
// the 29km x 3.9km strip.
function useInitialCameraTarget(buildings) {
  return useMemo(() => {
    const destroyed = buildings.filter((b) => b.damage === "Destroyed");
    const pool = destroyed.length > 0 ? destroyed : buildings;
    const coords = pool.map((b) => toSceneCoords(b.lat, b.lon));
    const avgX = coords.reduce((s, c) => s + c.x, 0) / coords.length;
    const avgZ = coords.reduce((s, c) => s + c.z, 0) / coords.length;
    return { x: avgX, z: avgZ };
  }, [buildings]);
}

export default function App() {
  const [buildings, setBuildings] = useState([]);

  useEffect(() => {
    setBuildings(buildingsData);
  }, []);

  const target = useInitialCameraTarget(
    buildings.length > 0 ? buildings : [{ id: 0, lat: 10.6, lon: -66.83, damage: "Destroyed" }]
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [target.x, 15, target.z + 25], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} />
        <SceneMarkers buildings={buildings} getColor={placeholderColor} />
        <OrbitControls target={[target.x, 0, target.z]} />
      </Canvas>
    </div>
  );
}