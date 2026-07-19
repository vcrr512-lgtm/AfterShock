// DamageMapDemo.jsx
// Test harness for DamageMap — now using the real 166-building dataset
// instead of the earlier 10 fake sample points.

import { useState } from 'react';
import DamageMap from './DamageMap';
import buildings from './data/buildings_scored.json';

export default function DamageMapDemo() {
  const [mode, setMode] = useState('medical');
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0c10', position: 'relative' }}>
      <DamageMap
        buildings={buildings}
        mode={mode}
        onSelectBuilding={(id) => setSelectedId(id)}
      />

      {/* Test-only controls — not part of the real component, just this harness */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          background: 'rgba(10, 12, 16, 0.8)',
          color: '#e8e8e8',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 13,
          padding: '10px 14px',
          borderRadius: 8,
        }}
      >
        <button
          onClick={() => setMode(mode === 'medical' ? 'machinery' : 'medical')}
          style={{ marginRight: 10, cursor: 'pointer' }}
        >
          Mode: {mode} (click to toggle)
        </button>
        <div style={{ marginTop: 6 }}>
          Selected building: {selectedId ?? 'none'}
        </div>
        <div style={{ marginTop: 4, opacity: 0.7 }}>
          {buildings.length} buildings loaded
        </div>
      </div>
    </div>
  );
}
