// city.js — Sunset Harbor: procedural city generation and spatial queries.
// One original sun-soaked coastal city: Downtown, Marina beach, Harbor docks,
// Palm Row suburbs and the North Hills. Roads form a grid; blocks hold
// buildings, parks, parking lots and plazas. All geometry is deterministic
// from the seed, so every player sees the same city.

import { createRng, clamp } from './random.js';

export const WORLD_SIZE = 3200;
export const ROAD_PITCH = 320;
export const ROAD_HALF = 38;

/** District names, used by the HUD location label and the story. */
export const DISTRICTS = [
  { name: 'Downtown', x0: 1100, y0: 900, x1: 2100, y1: 1900, color: '#8a93a8' },
  { name: 'Marina Beach', x0: 2600, y0: 0, x1: 3200, y1: 3200, color: '#e8c98a' },
  { name: 'Harbor Docks', x0: 0, y0: 2600, x1: 2600, y1: 3200, color: '#7d7468' },
  { name: 'Palm Row', x0: 0, y0: 0, x1: 1100, y1: 1100, color: '#7fae6e' },
  { name: 'North Hills', x0: 1100, y0: 0, x1: 2600, y1: 900, color: '#9db08a' },
  { name: 'Old Town', x0: 0, y0: 1100, x1: 1100, y1: 2600, color: '#b08d6a' },
];

/** Landmark spots the missions and shops anchor to. */
export const LANDMARKS = [
  { id: 'sunset-plaza', name: 'Sunset Plaza', x: 1600, y: 1600, kind: 'plaza' },
  { id: 'marina-pier', name: 'Marina Pier', x: 2960, y: 800, kind: 'pier' },
  { id: 'harbor-cranes', name: 'Harbor Cranes', x: 800, y: 2960, kind: 'docks' },
  { id: 'palm-motel', name: 'Palm Court Motel', x: 480, y: 480, kind: 'motel' },
  { id: 'paynspray', name: 'Turbo Tune Garage', x: 2240, y: 2240, kind: 'garage' },
  { id: 'gunshop', name: 'Ironclad Arms', x: 960, y: 2240, kind: 'gunshop' },
  { id: 'clinic', name: 'Harbor Clinic', x: 2240, y: 960, kind: 'clinic' },
  { id: 'casino', name: 'Neon Gull Casino', x: 1920, y: 1280, kind: 'casino' },
  { id: 'police-hq', name: 'Harbor PD HQ', x: 1280, y: 1920, kind: 'police' },
  { id: 'hospital', name: 'St. Anselm Hospital', x: 2560, y: 1920, kind: 'hospital' },
];

const ROOF_COLORS = ['#5b6b8c', '#7a6a58', '#4f6b5a', '#8c5b5b', '#6b5b8c', '#3f5a6b', '#946b4a', '#556b7a'];
const HOUSE_COLORS = ['#c9a06a', '#b98d7a', '#a8b08a', '#d8c49a', '#9ab0c0'];

/** Build the whole city from a seed. Returns { buildings, parks, trees, lots, water, roads }. */
export function generateCity(seed) {
  const rng = createRng(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  const lots = [];
  // Water: the sea east of the beach, plus the marina basin.
  const water = [
    { x: 2960, y: 0, w: 240, h: 3200 },
    { x: 2720, y: 560, w: 240, h: 480 },
  ];
  // One block per grid cell between road center lines.
  for (let bx = 0; bx < 10; bx++) {
    for (let by = 0; by < 10; by++) {
      const x0 = bx * ROAD_PITCH + ROAD_HALF + 14;
      const y0 = by * ROAD_PITCH + ROAD_HALF + 14;
      const x1 = (bx + 1) * ROAD_PITCH - ROAD_HALF - 14;
      const y1 = (by + 1) * ROAD_PITCH - ROAD_HALF - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // Beach strip: no buildings, sand and palms.
      if (x0 > 2600) {
        for (let t = 0; t < 5; t++) trees.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), r: rng.range(7, 11) });
        continue;
      }
      // Harbor docks: warehouses and containers, no parks.
      if (y0 > 2600) {
        const n = rng.int(1, 2);
        for (let i = 0; i < n; i++) {
          buildings.push(makeBuilding(rng, x0 + i * ((x1 - x0) / n), y0, (x1 - x0) / n, y1 - y0, 'warehouse'));
        }
        continue;
      }
      const roll = rng.next();
      if (roll < 0.14) {
        // Park block: lawn, paths, trees.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = rng.int(6, 11);
        for (let i = 0; i < n; i++) trees.push({ x: rng.range(x0 + 12, x1 - 12), y: rng.range(y0 + 12, y1 - 12), r: rng.range(6, 11) });
        continue;
      }
      if (roll < 0.24) {
        // Parking lot: open asphalt with painted bays.
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      if (roll < 0.30) {
        // Plaza: open paved square with a fountain circle.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, plaza: true });
        continue;
      }
      // Built block: 1-4 buildings.
      const downtown = cx > 1100 && cx < 2100 && cy > 900 && cy < 1900;
      const hills = cy < 900;
      const cols = downtown ? rng.int(1, 2) : rng.int(1, 2);
      const rows = rng.int(1, 2);
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (rng.chance(0.2)) continue;
          const w = (x1 - x0) / cols - 18;
          const h = (y1 - y0) / rows - 18;
          const x = x0 + i * ((x1 - x0) / cols) + 9;
          const y = y0 + j * ((y1 - y0) / rows) + 9;
          const kind = downtown ? 'tower' : hills ? 'house' : 'block';
          buildings.push(makeBuilding(rng, x, y, w, h, kind));
        }
      }
      if (rng.chance(0.5)) trees.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), r: rng.range(6, 10) });
    }
  }
  return { buildings, parks, trees, lots, water, seed };
}

function makeBuilding(rng, x, y, w, h, kind) {
  const tall = kind === 'tower';
  const color = kind === 'house' ? rng.pick(HOUSE_COLORS) : kind === 'warehouse' ? '#8a7a5a' : rng.pick(ROOF_COLORS);
  return {
    x, y, w, h, kind, color,
    height: tall ? rng.int(3, 9) : kind === 'block' ? rng.int(2, 4) : 1,
    roof: rng.pick(['flat', 'flat', 'garden', 'pool']),
  };
}

/** True when the point is on a road (drivable). */
export function isOnRoad(x, y) {
  const mx = ((x % ROAD_PITCH) + ROAD_PITCH) % ROAD_PITCH;
  const my = ((y % ROAD_PITCH) + ROAD_PITCH) % ROAD_PITCH;
  const nearX = mx < ROAD_HALF || mx > ROAD_PITCH - ROAD_HALF;
  const nearY = my < ROAD_HALF || my > ROAD_PITCH - ROAD_HALF;
  return nearX || nearY;
}

/** True when the point is in the sea. */
export function isWater(city, x, y) {
  return city.water.some((w) => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h);
}

/** Find the building whose AABB contains the point (with margin), or null. */
export function buildingAt(city, x, y, margin = 0) {
  for (const b of city.buildings) {
    if (x >= b.x - margin && x < b.x + b.w + margin && y >= b.y - margin && y < b.y + b.h + margin) return b;
  }
  return null;
}

/** Circle-vs-buildings collision: push the circle out, return the building hit or null. */
export function collideCircle(city, pos, r) {
  let hit = null;
  for (const b of city.buildings) {
    const cx = clamp(pos.x, b.x, b.x + b.w);
    const cy = clamp(pos.y, b.y, b.y + b.h);
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = b;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.y = cy + (dy / d) * r;
      } else {
        pos.y = b.y - r;
      }
    }
  }
  return hit;
}

/** Clamp a point inside the world, keeping it out of the sea. */
export function clampToWorld(city, pos, r) {
  pos.x = clamp(pos.x, 24, WORLD_SIZE - 24);
  pos.y = clamp(pos.y, 24, WORLD_SIZE - 24);
  if (isWater(city, pos.x, pos.y)) {
    pos.x = Math.min(pos.x, 2940);
  }
}

/** A random point on a road. */
export function randomRoadPoint(rng) {
  const vertical = rng.chance(0.5);
  const line = rng.int(0, 10) * ROAD_PITCH;
  const along = rng.range(60, WORLD_SIZE - 60);
  if (vertical) return { x: clamp(line, 40, WORLD_SIZE - 40), y: along };
  return { x: along, y: clamp(line, 40, WORLD_SIZE - 40) };
}

/** The nearest road center-line point to (x, y). */
export function nearestRoadPoint(x, y) {
  const rx = Math.round(x / ROAD_PITCH) * ROAD_PITCH;
  const ry = Math.round(y / ROAD_PITCH) * ROAD_PITCH;
  const dx = Math.abs(x - rx);
  const dy = Math.abs(y - ry);
  if (dx < dy) return { x: clamp(rx, 40, WORLD_SIZE - 40), y: clamp(y, 40, WORLD_SIZE - 40) };
  return { x: clamp(x, 40, WORLD_SIZE - 40), y: clamp(ry, 40, WORLD_SIZE - 40) };
}

/** District name for a point, for the HUD. */
export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Sunset Harbor';
}

/** Landmark lookup by id. */
export function landmark(id) {
  return LANDMARKS.find((l) => l.id === id) || null;
}
