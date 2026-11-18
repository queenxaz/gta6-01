// pedestrians.js — the people of Sunset Harbor.
// Pedestrians stroll the sidewalks, wait at crossings, flee from gunfire and
// speeding cars, and occasionally flag a cab. A few are gang lookouts in
// mission zones. All movement is simple steering with building avoidance.

import { createRng, clamp, dist, angleTo } from './random.js';
import { buildingAt, isOnRoad, nearestRoadPoint, WORLD_SIZE, ROAD_PITCH } from './city.js';

const SHIRTS = ['#e8e8e8', '#f2a541', '#5a8fd0', '#c95f7a', '#7ab56a', '#b06ad0', '#e05a4e', '#4ec2b8', '#f2e6c9', '#8a94a6'];
const SKINS = ['#f2c9a0', '#d9a06b', '#b07a4a', '#8a5a33', '#f7d7b5'];

/** Spawn pedestrians near the player. */
export function seedPedestrians(rng, count, cx, cy) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(40, 900);
    peds.push(makePed(rng, clamp(cx + Math.cos(a) * d, 60, WORLD_SIZE - 60), clamp(cy + Math.sin(a) * d, 60, WORLD_SIZE - 60)));
  }
  return peds;
}

export function makePed(rng, x, y) {
  return {
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(28, 62),
    shirt: rng.pick(SHIRTS),
    skin: rng.pick(SKINS),
    walkPhase: rng.range(0, 6),
    target: null,
    panic: 0,
    fleeX: 0, fleeY: 0,
    dead: false,
    lookout: false,
  };
}

/** Pick a nearby sidewalk point to walk toward. */
function pickTarget(ped, rng) {
  const p = nearestRoadPoint(ped.x + rng.range(-220, 220), ped.y + rng.range(-220, 220));
  // Sidewalk: offset just off the road center.
  const vertical = Math.abs(p.x % ROAD_PITCH) < 40;
  const off = 52;
  return {
    x: clamp(p.x + (vertical ? off : rng.range(-40, 40)), 50, WORLD_SIZE - 50),
    y: clamp(p.y + (vertical ? rng.range(-40, 40) : off), 50, WORLD_SIZE - 50),
  };
}

/** Update one pedestrian. danger: {x, y, radius} or null (gunfire / crash). */
export function updatePed(city, ped, dt, rng, danger, playerCar) {
  if (ped.dead) return;
  ped.walkPhase += dt * 8;
  if (danger && dist(ped.x, ped.y, danger.x, danger.y) < danger.radius) {
    ped.panic = 2.5;
    ped.fleeX = ped.x + (ped.x - danger.x);
    ped.fleeY = ped.y + (ped.y - danger.y);
  }
  if (playerCar && Math.abs(playerCar.speed) > 200 && dist(ped.x, ped.y, playerCar.x, playerCar.y) < 130) {
    ped.panic = 1.5;
    ped.fleeX = ped.x + (ped.x - playerCar.x) * 2;
    ped.fleeY = ped.y + (ped.y - playerCar.y) * 2;
  }
  if (ped.panic > 0) {
    ped.panic -= dt;
    const a = angleTo(ped.x, ped.y, ped.fleeX, ped.fleeY);
    ped.angle = a;
    const sp = ped.speed * 2.6;
    stepPed(city, ped, a, sp, dt);
    return;
  }
  if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 16) {
    ped.target = pickTarget(ped, rng);
  }
  const a = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
  ped.angle = a;
  stepPed(city, ped, a, ped.speed, dt);
}

function stepPed(city, ped, angle, speed, dt) {
  const nx = ped.x + Math.cos(angle) * speed * dt;
  const ny = ped.y + Math.sin(angle) * speed * dt;
  if (!buildingAt(city, nx, ny, 6)) {
    ped.x = nx; ped.y = ny;
  } else {
    ped.target = null;
  }
  ped.x = clamp(ped.x, 40, WORLD_SIZE - 40);
  ped.y = clamp(ped.y, 40, WORLD_SIZE - 40);
}

/** Keep the crowd topped up around the player. */
export function topUpPeds(peds, rng, player, want) {
  const near = peds.filter((p) => !p.dead && dist(p.x, p.y, player.x, player.y) < 900).length;
  for (let i = near; i < want; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(300, 850);
    peds.push(makePed(rng, clamp(player.x + Math.cos(a) * d, 60, WORLD_SIZE - 60), clamp(player.y + Math.sin(a) * d, 60, WORLD_SIZE - 60)));
  }
  // Cull the far dead and the far away.
  for (let i = peds.length - 1; i >= 0; i--) {
    if (dist(peds[i].x, peds[i].y, player.x, player.y) > 1500) peds.splice(i, 1);
  }
}

/** Pedestrians near a point (for bumping / combat checks). */
export function pedsNear(peds, x, y, radius) {
  return peds.filter((p) => !p.dead && dist(p.x, p.y, x, y) < radius);
}
