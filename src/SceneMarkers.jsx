// SceneMarkers.jsx
// Renders one marker per building. Color logic is injected via the
// `getColor` prop so it can be swapped later (damage-based -> score-based)
// without touching this component.

const refLat = 10.60;
const refLon = -66.95;

// Divide raw meters by this to bring the ~29km-wide strip down to a
// manageable scene size. Tune by eye if markers feel too spread out
// or too cramped once rendering.
export const SCENE_SCALE = 30;

export function toSceneCoords(lat, lon) {
  const xMeters = (lon - refLon) * 109600 * Math.cos((refLat * Math.PI) / 180);
  const zMeters = (lat - refLat) * 111320;
  return { x: xMeters / SCENE_SCALE, z: zMeters / SCENE_SCALE };
}

export default function SceneMarkers({ buildings, getColor, selectedId, onSelect }) {
  return (
    <>
      {buildings.map((b) => {
        const { x, z } = toSceneCoords(b.lat, b.lon);
        const isSelected = selectedId === b.id;
        return (
          <mesh
            position={[x, 0, z]}
            key={b.id}
            scale={isSelected ? 1.3 : 1}
            onClick={(event) => {
              event.stopPropagation();
              if (onSelect) onSelect(b);
            }}
          >
            <sphereGeometry args={[0.5, 8, 8]} />
            <meshStandardMaterial color={getColor(b)} />
          </mesh>
        );
      })}
    </>
  );
}