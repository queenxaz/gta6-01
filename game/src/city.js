// Solmar City: the road grid, the blocks between the roads, the buildings, parks, trees
// and the named places (garage, paint shop, gun shop, hospital, hideout, harbour, stadium).
// The city is generated once from a seed and never changes during a run; everything else
// in the game asks this module where things are and what blocks movement.
import { BEACH, PALETTE, ROADS, WORLD } from './config.js';
import { chance, pick, range, rangeInt } from './random.js';

export const SHOP_KIND = { GARAGE: 'garage', SPRAY: 'spray', GUNS: 'guns', HOSPITAL: 'hospital', HIDEOUT: 'hideout' };

/** Is the point on a road (including the road's shoulders)? */
export function onRoad(x, y) {
  for (const ax of ROADS.avenues) if (Math.abs(x - ax) <= ROADS.width / 2) return true;
  for (const sy of ROADS.streets) if (Math.abs(y - sy) <= ROADS.width / 2) return true;
  return false;
}

/** Is the point on a sidewalk (the strip just beside a road, not on it)? */
export function onSidewalk(x, y) {
  const m = ROADS.width / 2 + 14;
  for (const ax of ROADS.avenues) if (Math.abs(x - ax) <= m && Math.abs(x - ax) > ROADS.width / 2) return true;
  for (const sy of ROADS.streets) if (Math.abs(y - sy) <= m && Math.abs(y - sy) > ROADS.width / 2) return true;
  return false;
}

/** Nearest road centre line to a point, and whether it is an avenue (vertical) or street. */
export function nearestRoad(x, y) {
  let best = null;
  for (const ax of ROADS.avenues) {
    const d = Math.abs(x - ax);
    if (!best || d < best.d) best = { d, vertical: true, at: ax };
  }
  for (const sy of ROADS.streets) {
    const d = Math.abs(y - sy);
    if (!best || d < best.d) best = { d, vertical: false, at: sy };
  }
  return best;
}

/** Snap a point onto the nearest road's centre line. */
export function snapToRoad(x, y) {
  const r = nearestRoad(x, y);
  return r.vertical ? { x: r.at, y } : { x, y: r.at };
}

/** The lane offset a car driving in direction `angle` (0 = east) keeps to: right-hand traffic. */
export function laneOffset(angle) {
  // Driving east or south keeps to +lane on the cross axis; west or north to -lane.
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (Math.abs(c) > Math.abs(s)) return { dx: 0, dy: c > 0 ? ROADS.lane : -ROADS.lane };
  return { dx: s > 0 ? -ROADS.lane : ROADS.lane, dy: 0 };
}

export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const lots = [];
  const half = ROADS.width / 2;

  // Walk the grid of blocks between the roads; each block gets buildings, a park, or a lot.
  for (let ai = 0; ai < ROADS.avenues.length - 1; ai += 1) {
    for (let si = 0; si < ROADS.streets.length - 1; si += 1) {
      const x0 = ROADS.avenues[ai] + half + 18;
      const x1 = ROADS.avenues[ai + 1] - half - 18;
      const y0 = ROADS.streets[si] + half + 18;
      const y1 = ROADS.streets[si + 1] - half - 18;
      if (y0 > BEACH.sandY) continue;
      const roll = rng();
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: Math.min(y1 - y0, BEACH.sandY - y0) });
        const n = rangeInt(rng, 5, 10);
        for (let i = 0; i < n; i += 1) {
          trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, Math.min(y1 - 14, BEACH.sandY - 14)), r: range(rng, 9, 15) });
        }
        continue;
      }
      if (roll < 0.22) {
        lots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const cols = rangeInt(rng, 2, 3);
      const rows = rangeInt(rng, 1, 2);
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (chance(rng, 0.12)) continue;
          const bw = cw * range(rng, 0.62, 0.82);
          const bh = ch * range(rng, 0.6, 0.8);
          const bx = x0 + c * cw + (cw - bw) / 2;
          const by = y0 + r * ch + (ch - bh) / 2;
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            color: pick(rng, PALETTE.building),
            roof: pick(rng, PALETTE.roof),
            tall: chance(rng, 0.18),
          });
        }
      }
      if (chance(rng, 0.5)) {
        trees.push({ x: range(rng, x0 + 10, x1 - 10), y: range(rng, y0 + 10, y1 - 10), r: range(rng, 9, 13) });
      }
    }
  }

  // The Solmar Tower: the city's landmark, a tall block near the centre.
  const tower = { x: 1470, y: 530, w: 120, h: 120, color: '#5a7a8a', roof: '#31424e', tall: true, name: 'Solmar Tower' };
  buildings.push(tower);
  // The stadium, east side: a big open oval block with no buildings inside.
  const stadium = { x: 2960, y: 1620, w: 220, h: 150, color: '#7fa3b8', roof: '#d8d2c0', tall: false, name: 'Solmar Stadium' };
  buildings.push(stadium);

  // Named places, all on road corners so missions and shops are easy to reach.
  const shops = [
    { kind: SHOP_KIND.GARAGE, name: "Lena's Garage", x: 720, y: 880, label: 'GARAGE' },
    { kind: SHOP_KIND.SPRAY, name: 'Sunset Spray Shop', x: 2320, y: 580, label: 'SPRAY' },
    { kind: SHOP_KIND.GUNS, name: 'Gun Barn', x: 1120, y: 1780, label: 'GUNS' },
    { kind: SHOP_KIND.HOSPITAL, name: 'Solmar General', x: 2720, y: 1180, label: 'HOSPITAL' },
    { kind: SHOP_KIND.HIDEOUT, name: 'Jax Hideout', x: 320, y: 1480, label: 'HIDEOUT' },
  ];
  const harbour = { x: 3310, y: 1180, label: 'HARBOR' };
  const bank = { x: 1520, y: 880, label: 'BANK' };

  // Parked-car spots: along the road edges inside lots and on a few street corners.
  const parkedSpots = [];
  for (const lot of lots) {
    const n = rangeInt(rng, 2, 4);
    for (let i = 0; i < n; i += 1) {
      parkedSpots.push({
        x: range(rng, lot.x + 40, lot.x + lot.w - 40),
        y: range(rng, lot.y + 30, lot.y + lot.h - 30),
        angle: chance(rng, 0.5) ? 0 : Math.PI / 2,
      });
    }
  }
  for (let i = 0; i < 14; i += 1) {
    const ax = pick(rng, ROADS.avenues);
    const sy = pick(rng, ROADS.streets);
    parkedSpots.push({ x: ax + half + 16, y: sy + range(rng, -120, 120), angle: Math.PI / 2 });
  }

  // Hidden packages: 12 stashes tucked behind buildings and in parks.
  const packages = [];
  for (let i = 0; i < 12; i += 1) {
    const b = buildings[Math.floor(rng() * buildings.length)];
    packages.push({ x: b.x + b.w + 16, y: b.y + b.h / 2, taken: false });
  }

  const city = { buildings, trees, parks, lots, shops, harbour, bank, parkedSpots, packages, tower, stadium };

  /** Does the circle (x, y, r) hit any building? Returns the building or null. */
  city.hitsBuilding = (x, y, r) => {
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    return null;
  };

  /** Clamp a point inside the walkable world (never into the water). */
  city.clampWalk = (x, y) => ({
    x: Math.max(20, Math.min(WORLD.width - 20, x)),
    y: Math.max(20, Math.min(BEACH.waterY - 30, y)),
  });

  /** A random point on a road, for spawning traffic and pedestrians. */
  city.randomRoadPoint = () => {
    if (chance(rng, 0.5)) {
      return { x: pick(rng, ROADS.avenues), y: range(rng, 120, BEACH.sandY) };
    }
    return { x: range(rng, 120, WORLD.width - 120), y: pick(rng, ROADS.streets) };
  };

  /** A random sidewalk point, for spawning pedestrians. */
  city.randomSidewalkPoint = () => {
    if (chance(rng, 0.5)) {
      const ax = pick(rng, ROADS.avenues);
      return { x: ax + (chance(rng, 0.5) ? half + 10 : -half - 10), y: range(rng, 120, BEACH.sandY) };
    }
    const sy = pick(rng, ROADS.streets);
    return { x: range(rng, 120, WORLD.width - 120), y: sy + (chance(rng, 0.5) ? half + 10 : -half - 10) };
  };

  return city;
}
