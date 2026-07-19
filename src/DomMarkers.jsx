import React, { useMemo } from "react";
import { toSceneCoords, SCENE_SCALE } from "./SceneMarkers";

export default function DomMarkers({ buildings, getColor, selectedId, onSelect }) {
  const layout = useMemo(() => {
    if (!buildings || buildings.length === 0) return null;
    const coords = buildings.map((b) => ({ id: b.id, ...toSceneCoords(b.lat, b.lon) }));
    const xs = coords.map((c) => c.x);
    const zs = coords.map((c) => c.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    return { coords, minX, maxX, minZ, maxZ };
  }, [buildings]);

  if (!layout) return null;

  // Map scene coords -> container percent positions
  const mapToPercent = (x, z) => {
    const { minX, maxX, minZ, maxZ } = layout;
    const pad = 0.05 * Math.max(maxX - minX, maxZ - minZ);
    const width = maxX - minX + pad * 2;
    const height = maxZ - minZ + pad * 2;
    const nx = (x - (minX - pad)) / width; // 0..1
    const nz = (z - (minZ - pad)) / height; // 0..1
    return { left: nx * 100, top: (1 - nz) * 100, nx, nz };
  };

  const center = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = layout;
    return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  }, [layout]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", pointerEvents: "auto" }}>
      {layout.coords.map((c) => {
        const pos = mapToPercent(c.x, c.z);
        const dx = c.x - center.x;
        const dz = c.z - center.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        // size: inversely proportional to distance, clamped
        const size = Math.max(8, Math.round(24 - Math.min(dist * 0.06, 16)));
        const isSelected = selectedId === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onSelect && onSelect({ id: c.id })}
            style={{
              position: "absolute",
              left: `${pos.left}%`,
              top: `${pos.top}%`,
              transform: "translate(-50%, -50%)",
              width: size,
              height: size,
              borderRadius: "50%",
              border: isSelected ? "2px solid #facc15" : "1px solid rgba(255,255,255,0.06)",
              background: getColor(buildings.find((b) => b.id === c.id)),
              boxShadow: isSelected ? "0 8px 24px rgba(0,0,0,0.4)" : "0 6px 12px rgba(0,0,0,0.25)",
              cursor: "pointer",
              opacity: 0.95,
              padding: 0,
            }}
            aria-label={`Building ${c.id}`}
            title={`Building ${c.id}`}
          />
        );
      })}
    </div>
  );
}
