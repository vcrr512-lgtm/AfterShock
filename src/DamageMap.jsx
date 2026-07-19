// DamageMap.jsx
// PHASE 1 — map + terrain + satellite basemap.
// PHASE 2 — damage markers, one per building, built as MapLibre's native
// HTML Marker (a small DOM element MapLibre positions/repositions for you).
//
// NOTE ON APPROACH: the original plan was a Three.js custom WebGL layer
// (true 3D world-space spikes sharing the map's camera). That hit a
// rendering bug that couldn't be pinned down after extensive debugging, so
// this version uses MapLibre's built-in Marker API instead — a colored dot
// with a bar beneath it, sized by score. Same visual idea (dot + spike,
// colored by damage, height by score), same props contract, just far more
// reliable since MapLibre handles all positioning/terrain/zoom tracking
// internally instead of us hand-rolling WebGL matrix math.
//
// Dependencies: npm install maplibre-gl
//
// Props (full contract per spec):
//   buildings         Building[]                 drives bounds + markers
//   mode              "medical" | "machinery"     drives marker height/color
//   onSelectBuilding  (id: number) => void        fired on marker click

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

  const latSpan = maxLat - minLat || 0.01;
  const lonSpan = maxLon - minLon || 0.01;
  const latPad = latSpan * 0.1;
  const lonPad = lonSpan * 0.1;

  return {
    bounds: [
      [minLon - lonPad, minLat - latPad],
      [maxLon + lonPad, maxLat + latPad],
    ],
    center: {
      lon: (minLon + maxLon) / 2,
      lat: (minLat + maxLat) / 2,
    },
  };
}

/** Suggested color mapping from the spec — matches the Copernicus reference maps. */
function damageColorCss(damage) {
  switch (damage) {
    case 'Destroyed': return '#dc2626';        // red
    case 'Damaged': return '#f97316';          // orange
    case 'Possibly damaged': return '#eab308'; // yellow
    default: return '#9ca3af';                 // fallback gray — shouldn't occur with real data
  }
}

/** score (1–3) -> on-screen bar height in pixels. Tune visually. */
function scoreToHeightPx(score) {
  return 14 + (score || 0) * 14; // score 1 -> 28px, score 3 -> 56px
}

/**
 * Builds the DOM element for one marker: a colored dot with a bar beneath
 * it running down to the anchor point (bottom), sized/colored by damage +
 * active score. Returns both the outer element and refs to the dot/bar so
 * updateBuildings can restyle them in place on mode changes without
 * recreating the marker (keeps the "reshuffle" feel, not a rebuild).
 */
function createMarkerElement() {
  const el = document.createElement('div');
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.style.cursor = 'pointer';

  const dot = document.createElement('div');
  dot.style.width = '13px';
  dot.style.height = '13px';
  dot.style.borderRadius = '50%';
  dot.style.border = '2px solid rgba(255,255,255,0.9)';
  dot.style.boxShadow = '0 0 4px rgba(0,0,0,0.6)';
  dot.style.flexShrink = '0';

  const bar = document.createElement('div');
  bar.style.width = '3px';
  bar.style.opacity = '0.85';

  el.appendChild(dot);
  el.appendChild(bar);

  return { el, dot, bar };
}

export default function DamageMap({ buildings = [], mode = 'medical', onSelectBuilding }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const initialBuildingsRef = useRef(buildings); // snapshot used only for initial bounds/center

  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMsg, setErrorMsg] = useState(null);

  const markersRef = useRef(new Map()); // Map<buildingId, { marker, dot, bar }>
  const onSelectBuildingRef = useRef(onSelectBuilding);
  onSelectBuildingRef.current = onSelectBuilding; // always fresh, no re-add needed

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialBuildings = initialBuildingsRef.current;
    if (!initialBuildings || initialBuildings.length === 0) {
      setStatus('error');
      setErrorMsg('No buildings provided — cannot compute map bounds.');
      return;
    }

    const { bounds, center } = computeBoundsAndCenter(initialBuildings);

    // Hard pan/zoom limit — roughly Venezuela + the southern Caribbean.
    const REGIONAL_MAX_BOUNDS = [
      [-73.5, 5.5],
      [-58.0, 16.0],
    ];

    let map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: { version: 8, sources: {}, layers: [] },
        center: [center.lon, center.lat],
        zoom: 14,
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
        map.addSource('terrain-dem', {
          type: 'raster-dem',
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
          tileSize: 256,
          encoding: 'terrarium',
        });
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });

        map.addSource('satellite', {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Esri, Maxar, Earthstar Geographics',
        });
        map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite' });

        map.fitBounds(bounds, { padding: 60, pitch: 60, duration: 0 });

        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setErrorMsg(`Failed to add terrain/satellite layers: ${err.message}`);
      }
    });

    map.on('error', (e) => {
      console.error('MapLibre error:', e?.error || e);
    });

    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Adds/updates one Marker per building once the map is ready, then
  // restyles them in place (no recreate) on every buildings/mode change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;

    const scoreField = mode === 'machinery' ? 'machinery_score' : 'medical_score';
    const seenIds = new Set();

    for (const b of buildings) {
      seenIds.add(b.id);
      const color = damageColorCss(b.damage);
      const heightPx = scoreToHeightPx(b[scoreField]);

      let entry = markersRef.current.get(b.id);
      if (!entry) {
        const { el, dot, bar } = createMarkerElement();
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectBuildingRef.current?.(b.id);
        });

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([b.lon, b.lat])
          .addTo(map);

        entry = { marker, dot, bar };
        markersRef.current.set(b.id, entry);
      }

      entry.dot.style.background = color;
      entry.bar.style.background = color;
      entry.bar.style.height = `${heightPx}px`;
    }

    // Remove markers for buildings no longer present.
    for (const [id, entry] of markersRef.current) {
      if (!seenIds.has(id)) {
        entry.marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [status, buildings, mode]);

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
