// DamageMap.jsx
// PHASE 1 — map + terrain + satellite basemap only. No markers yet (that's Phase 2).
//
// Dependencies: npm install maplibre-gl
//
// Props (full contract per spec — mode/onSelectBuilding are accepted now but
// unused until Phase 2 wires in the Three.js marker layer):
//   buildings         Building[]                       used now, to compute bounds
//   mode              "medical" | "machinery"           unused in this phase
//   onSelectBuilding  (id: number) => void               unused in this phase

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * Derive a bounding box + center from real building coordinates.
 * Never hardcode a bbox — always compute it from the data that's passed in.
 */
function computeBoundsAndCenter(buildings) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;

  for (const b of buildings) {
    if (b.lat < minLat) minLat = b.lat;
    if (b.lat > maxLat) maxLat = b.lat;
    if (b.lon < minLon) minLon = b.lon;
    if (b.lon > maxLon) maxLon = b.lon;
  }

  // 10% padding on each axis. Guard against a degenerate single-point
  // dataset (padding of 0 would zoom in to nothing).
  const latSpan = maxLat - minLat || 0.01;
  const lonSpan = maxLon - minLon || 0.01;
  const latPad = latSpan * 0.1;
  const lonPad = lonSpan * 0.1;

  return {
    bounds: [
      [minLon - lonPad, minLat - latPad], // southwest
      [maxLon + lonPad, maxLat + latPad], // northeast
    ],
    center: {
      lon: (minLon + maxLon) / 2,
      lat: (minLat + maxLat) / 2,
    },
  };
}

export default function DamageMap({ buildings = [], mode = 'medical', onSelectBuilding }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const initialBuildingsRef = useRef(buildings); // snapshot used only for initial bounds/center

  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    // Map is initialized exactly once. Later re-renders (e.g. mode toggling,
    // or the parent re-passing a new buildings array reference) must NOT
    // tear down and rebuild the map — Phase 2 will update markers in place
    // instead. This effect intentionally has an empty dependency array.
    if (!containerRef.current || mapRef.current) return;

    const initialBuildings = initialBuildingsRef.current;
    if (!initialBuildings || initialBuildings.length === 0) {
      setStatus('error');
      setErrorMsg('No buildings provided — cannot compute map bounds.');
      return;
    }

    const { bounds, center } = computeBoundsAndCenter(initialBuildings);

    // Hard pan/zoom limit — roughly Venezuela + the southern Caribbean.
    // Prevents zooming/panning out to the whole globe (wasted tile loads,
    // and a bad look if someone scroll-zooms too far during a demo).
    // [southwest, northeast]
    const REGIONAL_MAX_BOUNDS = [
      [-73.5, 5.5],   // SW — past Venezuela's western border
      [-58.0, 16.0],  // NE — into the southern Caribbean, past Trinidad
    ];

    let map;
    try {
      map = new maplibregl.Map({
  container: containerRef.current,
  style: { version: 8, sources: {}, layers: [] },
  bounds,                                   // computed from real building data
  fitBoundsOptions: { padding: 60, pitch: 60 },
  pitch: 60,
  bearing: -20,
  antialias: true,
  maxBounds: REGIONAL_MAX_BOUNDS,
  minZoom: 6,
});
    } catch (err) {
      setStatus('error');
      setErrorMsg(`Failed to initialize map: ${err.message}`);
      return;
    }

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      try {
        // Real elevation data — free, no key, no signup.
        map.addSource('terrain-dem', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          encoding: 'terrarium',
        });
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });

        // Satellite basemap texture, drapes onto the terrain automatically.
        // NOTE: Esri World Imagery only. Per spec, no Vantor/Copernicus VHR
        // imagery anywhere in this pipeline — rights-restricted.
        map.addSource('satellite', {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Esri, Maxar, Earthstar Geographics',
        });
        map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite' });


        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setErrorMsg(`Failed to add terrain/satellite layers: ${err.message}`);
      }
    });

    map.on('error', (e) => {
      // MapLibre fires this for tile load failures etc. — log, don't crash.
      console.error('MapLibre error:', e?.error || e);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {status === 'loading' && (
        <div style={overlayStyle}>Loading terrain…</div>
      )}

      {status === 'error' && (
        <div style={{ ...overlayStyle, color: '#ff6b6b' }}>
          {errorMsg || 'Map failed to load.'}
        </div>
      )}
    </div>
  );
}

const overlayStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(10, 12, 16, 0.55)',
  color: '#e8e8e8',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
  pointerEvents: 'none',
};
