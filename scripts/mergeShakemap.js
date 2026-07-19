/**
 * mergeShakemap.js
 *
 * Adds `shakemap_mmi_min` to every building in buildings_scored.json,
 * using the real USGS ShakeMap contour product for event us6000t7zp
 * (cont_mmi.json).
 *
 * Usage:
 *   node scripts/mergeShakemap.js cont_mmi.json
 *
 * ---- What cont_mmi.json actually is ----
 * It's NOT a flat grid of points. It's a GeoJSON FeatureCollection of
 * MultiLineString isoseismal contours — one feature per MMI level
 * (3.0, 3.5, ... 8.5), each a set of closed rings. Because shaking
 * intensity decreases monotonically with distance from the source,
 * these rings nest: the 8.0 ring sits inside the 7.5 ring, which sits
 * inside the 7.0 ring, and so on.
 *
 * So a building's `shakemap_mmi_min` is the HIGHEST contour value whose
 * ring contains it — i.e. the floor of the band it's actually in. A
 * building inside the 7.5 ring but not the 8.0 ring is somewhere
 * between MMI 7.5 and 8.0, so shakemap_mmi_min = 7.5.
 *
 * This is checked with a standard ray-casting point-in-ring test against
 * every contour level, from highest to lowest, stopping at the first
 * (i.e. highest) match.
 *
 * ---- Alternate input: a flat grid ----
 * If you instead have a flat array of `{ lat, lon, mmi }` grid points
 * (e.g. from grid.xml converted to xyz), pass that file instead — the
 * script detects the shape and falls back to nearest-neighbor matching.
 * Point-in-polygon (this file's main path) is more accurate for a small
 * AOI like this one, so prefer cont_mmi.json when you have it.
 */

import fs from 'fs';

// --- point-in-polygon path (cont_mmi.json) ---

function pointInRing(lon, lat, ring) {
  // Ray casting. Works whether or not the ring is explicitly closed.
  const r = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring
    : [...ring, ring[0]];
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-15) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInMultiLine(lon, lat, coordinates) {
  return coordinates.some((ring) => pointInRing(lon, lat, ring));
}

function mmiFromContours(lat, lon, contourGeojson) {
  const featuresDesc = [...contourGeojson.features].sort(
    (a, b) => b.properties.value - a.properties.value
  );
  for (const f of featuresDesc) {
    if (pointInMultiLine(lon, lat, f.geometry.coordinates)) {
      return f.properties.value;
    }
  }
  return null; // outside even the lowest contour in the file
}

// --- flat-grid fallback path ---

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestMmi(lat, lon, gridPoints) {
  let best = null;
  let bestDist = Infinity;
  for (const p of gridPoints) {
    const d = haversineKm(lat, lon, p.lat, p.lon);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best ? { mmi: Math.round(best.mmi * 2) / 2, distanceKm: bestDist } : null;
}

// --- main ---

function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath) {
    console.error('Usage: node scripts/mergeShakemap.js <cont_mmi.json | flat-grid.json>');
    process.exit(1);
  }

  const buildings = JSON.parse(fs.readFileSync('buildings_scored.json', 'utf8'));
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const isContourGeojson = source.type === 'FeatureCollection' && Array.isArray(source.features);
  const isGrid = Array.isArray(source);

  let missing = 0;
  let maxMatchDistanceKm = 0;

  const updated = buildings.map((b) => {
    let mmi = null;

    if (isContourGeojson) {
      mmi = mmiFromContours(b.lat, b.lon, source);
    } else if (isGrid) {
      const match = nearestMmi(b.lat, b.lon, source);
      if (match) {
        mmi = match.mmi;
        maxMatchDistanceKm = Math.max(maxMatchDistanceKm, match.distanceKm);
      }
    } else {
      // per-id lookup: { "0": 7.5, "1": 8.0, ... }
      const raw = source[b.id];
      if (raw != null) mmi = raw;
    }

    if (mmi == null) missing += 1;
    return { ...b, shakemap_mmi_min: mmi };
  });

  fs.writeFileSync('buildings_scored.json', JSON.stringify(updated, null, 2));

  console.log(`Wrote ${updated.length} buildings.`);
  if (missing > 0) {
    console.warn(`WARNING: ${missing} building(s) got no shakemap_mmi_min — they fell outside every contour ring in the file (i.e. below its lowest level).`);
  }
  if (isGrid && maxMatchDistanceKm > 2) {
    console.warn(`WARNING: worst-case nearest-grid-point distance was ${maxMatchDistanceKm.toFixed(2)} km — wide for a few-block AOI, treat boundary bands as uncertain.`);
  }

  const bandCounts = updated.reduce((acc, b) => {
    const key = b.shakemap_mmi_min ?? 'missing';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  console.log('Band distribution:', bandCounts);
}

main();
