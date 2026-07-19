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
import shakemapLinesData from './data/shakemap_lines.json';

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
    case 'Destroyed': return '#b91c1c';        // deep red — unchanged
    case 'Damaged': return '#fb923c';          // paler, lighter orange — pulls it away from red toward the light end
    case 'Possibly damaged': return '#fde047'; // brighter, more saturated yellow — clear high-contrast top note
    default: return '#9ca3af';                 // fallback gray — shouldn't occur with real data
  }
}

/**
 * Maps a raw score to an on-screen bar height, scaled relative to the
 * actual min/max of the CURRENTLY ACTIVE score field across all buildings
 * — not a fixed range. This matters because medical_score is always 1–3,
 * but machinery_score is unbounded (clustering-weighted, real data goes
 * up to 14+). A fixed multiplier tuned for 1–3 would make Machinery mode
 * bars comically tall. Both modes now always render in the same sane
 * MIN_PX–MAX_PX range regardless of their underlying scale.
 */
const MIN_PX = 16;
const MAX_PX = 70;

function normalizedHeightPx(score, minScore, maxScore) {
  const range = maxScore - minScore || 1; // guard divide-by-zero if all scores equal
  const t = ((score || 0) - minScore) / range;
  return MIN_PX + t * (MAX_PX - MIN_PX);
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

  const aerialBoundsRef = useRef(null); // stored on load, reused by "back to overview"
  const [flyMode, setFlyMode] = useState(false);
  const [shakemapVisible, setShakemapVisible] = useState(false);
  const shakemapLayerIdsRef = useRef([]);

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
        pitch: 0,        // starts near top-down; flies into the aerial angle below on load
        bearing: 0,
        antialias: true,
        maxBounds: REGIONAL_MAX_BOUNDS,
        minZoom: 6,
        maxPitch: 85,    // default cap is 60° — too low for a near-horizontal fly-through feel
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
          maxzoom: 13, // pulled back from 15 — this dataset's real detail is coarse anyway (~30m), so this just skips pointless tile requests at close zoom, no real detail lost
        });
        // Lower exaggeration than before — steep exaggerated terrain looks
        // fine from far above, but reads as jittery/glitchy up close during
        // fly-through, since small elevation changes get visually amplified.
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.0 });

        map.addSource('satellite', {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          maxzoom: 18, // caps requests at Esri's real available resolution instead of over-zooming and stalling on retries
          attribution: 'Esri, Maxar, Earthstar Geographics',
        });
        map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite' });

        // Real USGS ShakeMap contour data for this event (us6000t7zp),
        // rendered as the actual contour lines (each ring is where shaking
        // intensity crosses that MMI threshold), colored per USGS's own
        // legend color for each level.
        map.addSource('shakemap-lines', { type: 'geojson', data: shakemapLinesData });
        map.addLayer({
          id: 'shakemap-lines-layer',
          type: 'line',
          source: 'shakemap-lines',
          layout: { visibility: 'none', 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-opacity': 0.85,
          },
        });
        shakemapLayerIdsRef.current = ['shakemap-lines-layer'];

        // Sky + atmospheric fog — without this, anything above the horizon
        // renders as flat black, and the edge where satellite tiles stop
        // loading cuts off abruptly. This blends both into something that
        // reads as sky/haze instead of a void.
        map.setSky({
          'sky-color': '#87ceeb',
          'sky-horizon-blend': 0.5,
          'horizon-color': '#cfe8f5',
          'horizon-fog-blend': 0.6,
          'fog-color': '#cfe8f5',
          'fog-ground-blend': 0.5,
        });

        // Brief pause so satellite/terrain tiles have a moment to actually
        // paint before the camera starts moving — otherwise the fly-in
        // plays while the view is still blank/loading.
        aerialBoundsRef.current = bounds;
        setTimeout(() => {
          // Slow, straight-down-leaning aerial angle (15° — enough to still
          // read the marker spikes as 3D, without tilting into a horizon
          // view on a ~29km-wide extent). North-up, no rotation.
          map.fitBounds(bounds, { padding: 60, pitch: 15, bearing: 0, duration: 3200 });
        }, 1200);

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

    // Compute the active field's actual range once per update — this is
    // what lets Medical (1–3) and Machinery (unbounded, real data goes to
    // 14+) both render in the same sane visual height range.
    const scores = buildings.map((b) => b[scoreField] || 0);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    // "Most severe shaking zone" — the highest shakemap_mmi_min value
    // present in the data, computed dynamically rather than hardcoded, so
    // this stays correct if the underlying USGS data range ever changes.
    // Field is optional; buildings without it are just never flagged.
    const mmiValues = buildings
      .map((b) => b.shakemap_mmi_min)
      .filter((v) => typeof v === 'number');
    const maxMmi = mmiValues.length > 0 ? Math.max(...mmiValues) : null;

    for (const b of buildings) {
      seenIds.add(b.id);
      const color = damageColorCss(b.damage);
      const heightPx = normalizedHeightPx(b[scoreField], minScore, maxScore);
      const isSevereShaking = maxMmi != null && b.shakemap_mmi_min === maxMmi;

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

      // Buildings in the most severe shaking zone get a bright ring instead
      // of the default white one — a quick visual flag for "this building's
      // damage may not match what the shaking intensity alone predicts."
      if (isSevereShaking) {
        entry.dot.style.border = '3px solid #38bdf8'; // sky blue, reads clearly against red/orange/yellow
        entry.dot.style.boxShadow = '0 0 6px rgba(56,189,248,0.9), 0 0 4px rgba(0,0,0,0.6)';
      } else {
        entry.dot.style.border = '2px solid rgba(255,255,255,0.9)';
        entry.dot.style.boxShadow = '0 0 4px rgba(0,0,0,0.6)';
      }
    }

    // Remove markers for buildings no longer present.
    for (const [id, entry] of markersRef.current) {
      if (!seenIds.has(id)) {
        entry.marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [status, buildings, mode]);

  /**
   * Smooth, continuous keyboard flight while fly mode is active — replaces
   * MapLibre's default discrete-jump keyboard handler (disabled in
   * toggleFlyMode below). Tracks which keys are currently held and, every
   * animation frame, nudges the camera by an amount scaled to actual
   * elapsed time — so movement stays smooth regardless of frame rate or
   * how the OS/browser is repeating the keypress.
   *
   * Arrow Up/Down (or W/S)     — move forward/backward
   * Arrow Left/Right (or A/D)  — strafe left/right
   * Shift + Left/Right         — rotate (bearing)
   * Shift + Up/Down            — tilt (pitch)
   * Space / Ctrl               — ascend / descend (altitude, via zoom)
   */
  useEffect(() => {
    if (!flyMode) return;
    const map = mapRef.current;
    if (!map) return;

    const HANDLED_KEYS = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'w', 'W', 'a', 'A', 's', 'S', 'd', 'D',
      ' ', 'Control',
    ]);

    const held = new Set();
    const handleKeyDown = (e) => {
      if (HANDLED_KEYS.has(e.key)) e.preventDefault(); // stop Space/arrows from scrolling the page
      held.add(e.key);
    };
    const handleKeyUp = (e) => held.delete(e.key);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const PAN_PX_PER_SEC = 900;   // screen-space pan speed
    const ROTATE_DEG_PER_SEC = 60;
    const PITCH_DEG_PER_SEC = 40;
    const ZOOM_PER_SEC = 1.1;     // altitude change rate
    const MIN_ZOOM = 13;          // too far out and fly mode stops feeling like flying
    const MAX_ZOOM = 19;

    let rafId;
    let lastTime = performance.now();

    const tick = (now) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const shiftHeld = held.has('Shift');
      let dx = 0, dy = 0, dBearing = 0, dPitch = 0, dZoom = 0;

      const forward = held.has('ArrowUp') || held.has('w') || held.has('W');
      const backward = held.has('ArrowDown') || held.has('s') || held.has('S');
      const left = held.has('ArrowLeft') || held.has('a') || held.has('A');
      const right = held.has('ArrowRight') || held.has('d') || held.has('D');
      const ascend = held.has(' ');
      const descend = held.has('Control');

      if (shiftHeld) {
        if (left) dBearing -= ROTATE_DEG_PER_SEC * dt;
        if (right) dBearing += ROTATE_DEG_PER_SEC * dt;
        if (forward) dPitch += PITCH_DEG_PER_SEC * dt;
        if (backward) dPitch -= PITCH_DEG_PER_SEC * dt;
      } else {
        if (forward) dy -= PAN_PX_PER_SEC * dt;
        if (backward) dy += PAN_PX_PER_SEC * dt;
        if (left) dx -= PAN_PX_PER_SEC * dt;
        if (right) dx += PAN_PX_PER_SEC * dt;
      }

      // Ascend = zoom out (camera pulls back, reads as gaining altitude);
      // descend = zoom in. Independent of the shift modifier above.
      if (ascend) dZoom -= ZOOM_PER_SEC * dt;
      if (descend) dZoom += ZOOM_PER_SEC * dt;

      if (dx !== 0 || dy !== 0) {
        map.panBy([dx, dy], { duration: 0, animate: false });
      }
      if (dBearing !== 0) {
        map.setBearing(map.getBearing() + dBearing);
      }
      if (dPitch !== 0) {
        const nextPitch = Math.min(85, Math.max(0, map.getPitch() + dPitch));
        map.setPitch(nextPitch);
      }
      if (dZoom !== 0) {
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, map.getZoom() + dZoom));
        map.setZoom(nextZoom);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(rafId);
    };
  }, [flyMode]);

  // Shows/hides the real USGS ShakeMap contour bands. Off by default so it
  // doesn't clutter the default damage-marker view; a toggle button below
  // switches it on for the moments it's actually wanted.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;

    const visibility = shakemapVisible ? 'visible' : 'none';
    for (const id of shakemapLayerIdsRef.current) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', visibility);
      }
    }
  }, [shakemapVisible, status]);

  /**
   * Toggles between the clean aerial overview and a low, close-in
   * "fly-through" pose (steep pitch, tighter zoom) — the kind of angle
   * where MapLibre's built-in keyboard controls (arrow keys to pan, plus
   * shift+arrows to rotate/tilt) actually feel like flying low over the
   * terrain, rather than nudging an overhead map.
   */
  const toggleFlyMode = () => {
    const map = mapRef.current;
    if (!map) return;

    if (!flyMode) {
      const center = map.getCenter();
      // Terrain stays on, but at a much lower exaggeration and a less
      // extreme pitch/zoom than the max possible — perf cost during
      // fly-through scales heavily with how many terrain tiles are
      // visible at once, and a very steep, close-in camera sees ground
      // stretching all the way to the horizon (far more tiles than a
      // top-down view). Easing pitch/zoom back cuts that workload a lot
      // while still feeling meaningfully more horizontal than before.
      map.setTerrain({ source: 'terrain-dem', exaggeration: 0.4 });
      map.flyTo({
        center,
        zoom: 15.5,      // eased back further from 16.5 — fewer visible tiles at this pitch
        pitch: 70,       // eased back from 82 — still well past the old 60° cap, less horizon tile load
        bearing: map.getBearing(),
        duration: 1800,
        essential: true,
      });
      // MapLibre's built-in keyboard handler moves the camera in fixed,
      // discrete jumps per keypress rather than smooth continuous motion —
      // combined with inconsistent OS key-repeat timing, that reads as
      // jerky/glitchy. Disabling it here; a custom requestAnimationFrame
      // loop below drives smooth movement instead while held keys are down.
      map.keyboard.disable();
      setFlyMode(true);
    } else {
      map.keyboard.enable();
      map.setTerrain({ source: 'terrain-dem', exaggeration: 1.0 }); // restore full relief for the overview
      const bounds = aerialBoundsRef.current;
      if (bounds) {
        map.fitBounds(bounds, { padding: 60, pitch: 15, bearing: 0, duration: 1800 });
      }
      setFlyMode(false);
    }
  };

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

      {status === 'ready' && (
        <div style={flyButtonWrapperStyle}>
          <button onClick={toggleFlyMode} style={flyButtonStyle}>
            {flyMode ? '↑ Back to overview' : '✈ Fly-through mode'}
          </button>
          <button onClick={() => setShakemapVisible((v) => !v)} style={flyButtonStyle}>
            {shakemapVisible ? '⬤ Hide shaking intensity' : '⬤ Show shaking intensity'}
          </button>
          {flyMode && (
            <div style={flyHintStyle}>
              Arrow keys / WASD to move · Shift+arrows to rotate/tilt · Space/Ctrl for altitude
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const flyButtonWrapperStyle = {
  position: 'absolute',
  bottom: 16,
  left: 16,
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 6,
};

const flyButtonStyle = {
  background: 'rgba(10, 12, 16, 0.85)',
  color: '#e8e8e8',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 6,
  padding: '8px 14px',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
  cursor: 'pointer',
};

const flyHintStyle = {
  background: 'rgba(10, 12, 16, 0.75)',
  color: '#c8c8c8',
  borderRadius: 6,
  padding: '4px 10px',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 11,
};

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
