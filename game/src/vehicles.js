// vehicles.js — cars of Sunset Harbor: definitions, traffic, and driving.
// Traffic cars cruise the road grid and turn at intersections; parked cars
// wait in lots and curbs. The player can steal any of them. Car physics is
// arcade: throttle, brake/reverse, steering that bites harder at low speed,
// handbrake slides, and collisions that bounce and spark.

import { createRng, clamp, angleDiff, dist } from './random.js';
import { isOnRoad, nearestRoadPoint, WORLD_SIZE, ROAD_PITCH, buildingAt, collideCircle } from './city.js';

export const CAR_DEFS = [
  { id: 'sedan', name: 'Harbor Sedan', color: '#c94f4f', top: 0.85, accel: 300, len: 46, wid: 22 },
  { id: 'taxi', name: 'Sun Cab', color: '#f2c230', top: 0.8, accel: 290, len: 46, wid: 22 },
  { id: 'coupe', name: 'Gullwing Coupe', color: '#3f7fd0', top: 1.0, accel: 360, len: 44, wid: 21 },
  { id: 'van', name: 'Dock Van', color: '#8a94a6', top: 0.7, accel: 240, len: 52, wid: 24 },
  { id: 'pickup', name: 'Ranchero Pickup', color: '#5a9e6a', top: 0.85, accel: 300, len: 50, wid: 23 },
  { id: 'muscle', name: 'Sunset Muscle', color: '#d06a2e', top: 0.95, accel: 340, len: 48, wid: 23 },
  { id: 'limousine', name: 'Gull Limo', color: '#2b2b33', top: 0.8, accel: 260, len: 62, wid: 23 },
  { id: 'police', name: 'HPD Interceptor', color: '#1e2a3a', top: 1.05, accel: 380, len: 47, wid: 22 },
];

export function carDef(id) {
  return CAR_DEFS.find((c) => c.id === id) || CAR_DEFS[0];
}

let nextCarId = 1;

/** Create a car entity. */
export function makeCar(defId, x, y, angle, opts = {}) {
  const def = carDef(defId);
  return {
    id: nextCarId++,
    defId, def,
    x, y, angle,
    speed: 0,
    color: opts.color || def.color,
    traffic: !!opts.traffic,
    police: defId === 'police',
    parked: !!opts.parked,
    driver: opts.driver !== false,
    targetSpeed: opts.traffic ? 120 + Math.random() * 60 : 0,
    health: 100,
    smoke: 0,
    hornTimer: 0,
    stuckTimer: 0,
    dead: false,
  };
}

/** Spawn the starting traffic and parked cars for a new game. */
export function seedTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = { x: 0, y: 0 };
    const rp = nearestRoadPoint(rng.range(100, WORLD_SIZE - 100), rng.range(100, WORLD_SIZE - 100));
    p.x = rp.x; p.y = rp.y;
    const vertical = Math.abs(p.x % ROAD_PITCH) < 40;
    const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const def = rng.pick(['sedan', 'sedan', 'taxi', 'coupe', 'van', 'pickup', 'muscle']);
    const car = makeCar(def, p.x + rng.range(-8, 8), p.y + rng.range(-8, 8), angle, { traffic: true });
    car.speed = car.targetSpeed * rng.range(0.7, 1);
    cars.push(car);
  }
  // Parked cars in lots and along curbs.
  for (let i = 0; i < 26; i++) {
    const rp = nearestRoadPoint(rng.range(100, WORLD_SIZE - 100), rng.range(100, WORLD_SIZE - 100));
    const vertical = Math.abs(rp.x % ROAD_PITCH) < 40;
    const off = vertical ? 30 : 0;
    const offY = vertical ? 0 : 30;
    const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const def = rng.pick(['sedan', 'coupe', 'pickup', 'van', 'muscle', 'limousine']);
    cars.push(makeCar(def, rp.x + off * (rng.chance(0.5) ? 1 : -1), rp.y + offY * (rng.chance(0.5) ? 1 : -1), angle, { parked: true, driver: false }));
  }
  return cars;
}

/** Keep traffic topped up near the player. */
export function topUpTraffic(city, cars, player, rng, want) {
  const near = cars.filter((c) => c.traffic && !c.dead && dist(c.x, c.y, player.x, player.y) < 1600).length;
  if (near >= want) return;
  for (let i = near; i < want; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(500, 1100);
    const px = clamp(player.x + Math.cos(a) * d, 80, WORLD_SIZE - 80);
    const py = clamp(player.y + Math.sin(a) * d, 80, WORLD_SIZE - 80);
    const rp = nearestRoadPoint(px, py);
    const vertical = Math.abs(rp.x % ROAD_PITCH) < 40;
    const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const def = rng.pick(['sedan', 'sedan', 'taxi', 'coupe', 'van', 'pickup']);
    const car = makeCar(def, rp.x, rp.y, angle, { traffic: true });
    car.speed = car.targetSpeed;
    cars.push(car);
  }
}

/** Drive a traffic car along the grid: follow its road, turn at intersections. */
export function updateTrafficCar(city, car, cars, dt, rng) {
  if (car.dead || car.parked) return;
  // Slow down if a car is close ahead.
  const aheadX = car.x + Math.cos(car.angle) * 70;
  const aheadY = car.y + Math.sin(car.angle) * 70;
  let blocked = false;
  for (const other of cars) {
    if (other === car || other.dead) continue;
    if (dist(aheadX, aheadY, other.x, other.y) < 34) { blocked = true; break; }
  }
  const want = blocked ? 0 : car.targetSpeed;
  car.speed += clamp(want - car.speed, -260 * dt, 150 * dt);
  // At an intersection, sometimes turn.
  const mx = ((car.x % ROAD_PITCH) + ROAD_PITCH) % ROAD_PITCH;
  const my = ((car.y % ROAD_PITCH) + ROAD_PITCH) % ROAD_PITCH;
  const atX = mx < 26 || mx > ROAD_PITCH - 26;
  const atY = my < 26 || my > ROAD_PITCH - 26;
  if (atX && atY && rng.chance(0.02)) {
    const turns = [-Math.PI / 2, Math.PI / 2, 0];
    const turn = rng.pick(turns);
    car.angle += turn;
  }
  // Steer back onto the road center line.
  const rp = nearestRoadPoint(car.x, car.y);
  const vertical = Math.abs(car.x - rp.x) < Math.abs(car.y - rp.y);
  const lane = vertical ? rp.x : rp.y;
  const pos = vertical ? car.x : car.y;
  const err = lane - pos;
  const desired = vertical ? (Math.sin(car.angle) > 0 ? Math.PI / 2 : -Math.PI / 2) : (Math.cos(car.angle) > 0 ? 0 : Math.PI);
  car.angle += angleDiff(car.angle, desired) * Math.min(1, 2.2 * dt) + clamp(err * 0.004, -0.4, 0.4) * dt * 10;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (!isOnRoad(car.x, car.y)) {
    // Wandered off: snap back to the nearest road.
    const np = nearestRoadPoint(car.x, car.y);
    car.x = np.x; car.y = np.y;
  }
  collideCircle(city, car, 20);
  car.x = clamp(car.x, 30, WORLD_SIZE - 30);
  car.y = clamp(car.y, 30, WORLD_SIZE - 30);
}

/** Arcade driving for the player's car. Returns true if it crashed hard. */
export function drivePlayerCar(city, car, input, dt, cars) {
  const def = car.def;
  const top = 560 * def.top;
  const fwd = input.down('w', 'ArrowUp') ? 1 : input.down('s', 'ArrowDown') ? -1 : 0;
  const steer = input.down('a', 'ArrowLeft') ? -1 : input.down('d', 'ArrowRight') ? 1 : 0;
  const handbrake = input.down(' ');
  if (fwd > 0) car.speed += def.accel * dt;
  else if (fwd < 0) car.speed -= (car.speed > 5 ? 420 : 200) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 500 * dt);
  car.speed = clamp(car.speed, -220, top);
  const steerAuthority = clamp(1 - Math.abs(car.speed) / (top * 1.4), 0.25, 1);
  const grip = handbrake ? 1.6 : 1;
  car.angle += steer * 2.4 * steerAuthority * grip * dt * Math.sign(car.speed || 1) * (car.speed < 0 ? -1 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  let crashed = false;
  const probe = { x: nx, y: ny };
  if (buildingAt(city, nx, ny, 12)) {
    car.speed *= -0.25;
    crashed = true;
  } else {
    car.x = nx; car.y = ny;
  }
  // Bump into other cars.
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 44 && d > 0.01) {
      const push = (44 - d) / 2;
      const ux = (car.x - other.x) / d;
      const uy = (car.y - other.y) / d;
      car.x += ux * push; car.y += uy * push;
      if (!other.traffic || other.parked) { other.x -= ux * push; other.y -= uy * push; }
      if (Math.abs(car.speed) > 240) { crashed = true; other.health -= 20; }
      car.speed *= 0.82;
    }
  }
  collideCircle(city, car, 20);
  car.x = clamp(car.x, 30, WORLD_SIZE - 30);
  car.y = clamp(car.y, 30, WORLD_SIZE - 30);
  if (car.health <= 0 && !car.dead) { car.dead = true; car.smoke = 1; }
  return crashed;
}

/** Nearest car to a point within range, preferring drivable ones. */
export function nearestCar(cars, x, y, range) {
  let best = null;
  let bestD = range;
  for (const c of cars) {
    if (c.dead) continue;
    const d = dist(c.x, c.y, x, y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** Explosion damage: cars near the blast take damage and may die. */
export function damageCarsNear(cars, x, y, radius, dmg) {
  const killed = [];
  for (const c of cars) {
    if (c.dead) continue;
    if (dist(c.x, c.y, x, y) < radius) {
      c.health -= dmg;
      if (c.health <= 0) { c.dead = true; c.smoke = 1; killed.push(c); }
    }
  }
  return killed;
}
