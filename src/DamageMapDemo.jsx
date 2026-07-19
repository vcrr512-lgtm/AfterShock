// DamageMapDemo.jsx
// Standalone test harness for DamageMap — drop this in as a route/page to
// verify the map, terrain, and satellite layer work before wiring in the
// real 166-building dataset or the Phase 2 marker layer.
//
// Usage (e.g. in main.jsx or a temp route):
//   import DamageMapDemo from './DamageMapDemo';
//   ReactDOM.createRoot(document.getElementById('root')).render(<DamageMapDemo />);

import DamageMap from './DamageMap';

// Sample points scattered around Caraballeda/La Guaira (~10.60, -66.95).
// Real shape matches the Building data contract — swap this array for the
// real 166 once Phase 1 is confirmed working.
const sampleBuildings = [
  { id: 1, lat: 10.6081, lon: -66.9310, damage: 'Destroyed', medical_score: 3, machinery_score: 3 },
  { id: 2, lat: 10.6072, lon: -66.9325, damage: 'Damaged', medical_score: 2, machinery_score: 2 },
  { id: 3, lat: 10.6095, lon: -66.9298, damage: 'Possibly damaged', medical_score: 1, machinery_score: 1 },
  { id: 4, lat: 10.6060, lon: -66.9340, damage: 'Destroyed', medical_score: 3, machinery_score: 3 },
  { id: 5, lat: 10.6110, lon: -66.9280, damage: 'Damaged', medical_score: 2, machinery_score: 1 },
  { id: 6, lat: 10.5990, lon: -66.9550, damage: 'Destroyed', medical_score: 3, machinery_score: 2 },
  { id: 7, lat: 10.6005, lon: -66.9530, damage: 'Possibly damaged', medical_score: 1, machinery_score: 1 },
  { id: 8, lat: 10.5940, lon: -66.9700, damage: 'Damaged', medical_score: 2, machinery_score: 2 },
  { id: 9, lat: 10.6150, lon: -66.9200, damage: 'Destroyed', medical_score: 3, machinery_score: 3 },
  { id: 10, lat: 10.5900, lon: -66.9800, damage: 'Possibly damaged', medical_score: 1, machinery_score: 1 },
];

export default function DamageMapDemo() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0c10' }}>
      <DamageMap
        buildings={sampleBuildings}
        mode="medical"
        onSelectBuilding={(id) => console.log('selected building', id)}
      />
    </div>
  );
}
