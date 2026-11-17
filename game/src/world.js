// SOLMAR's simulation: the player on foot and in cars, traffic and pedestrians, police
// and the wanted level, combat, missions, fares, shops, pickups and the save. No drawing
// and no browser in here — step() advances one fixed step and returns what happened, so
// the caller can play sounds and change screens without the world knowing about them.
import { BEACH, CAR, ECONOMY, PISTOL, PLAYER, ROADS, TRAFFIC, WANTED, WORLD } from './config.js';
import { angleDiff, angleTo, clamp, dist2, pick, range } from './random.js';
import { laneOffset, nearestRoad, SHOP_KIND } from './city.js';
import { createMissionEngine } from './missions.js';

export const EVENT_NONE = 0;
export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_CRASH = 4;
export const EVENT_PICKUP = 8;
export const EVENT_CASH = 16;
export const EVENT_BUSTED = 32;
export const EVENT_WASTED = 64;
export const EVENT_MISSION_STEP = 128;
export const EVENT_MISSION_DONE = 256;
export const EVENT_MISSION_FAIL = 512;
export const EVENT_STEAL = 1024;
export const EVENT_EXPLOSION = 2048;

const CAR_COLORS = ['#d84a4a', '#4a7fd8', '#e8e8e8', '#3a3a3a', '#e8a23a', '#5aa84a', '#8a5ad8', '#d8d8c8'];
const PED_SHIRTS = ['#e8e8e8', '#d8a05a', '#7fa3b8', '#b8b0a0', '#a87f6a', '#8a6f9e', '#6f9e7a', '#c96f4a'];

function circleRectPush(x, y, r, b) {
  const cx = clamp(x, b.x, b.x + b.w);
  const cy = clamp(y, b.y, b.y + b.h);
  const dx = x - cx;
  const dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 === 0) return { x: x + r, y };
  const d = Math.sqrt(d2);
  const push = (r - d) / d;
  return { x: x + dx * push, y: y + dy * push };
}

export function createWorld(random, city) {
  const missions = createMissionEngine();
  const state = {
    time: 0,
    cash: ECONOMY.startCash,
    wanted: 0,
    wantedFloat: 0,
    lastCrime: -100,
    player: {
      x: 720, y: 950, angle: -Math.PI / 2, health: PLAYER.health,
      ammo: PISTOL.startAmmo, car: null, punchCooldown: 0, shootCooldown: 0,
      speed: 0, moving: false, hurtCooldown: 0,
    },
    cars: [],
    peds: [],
    particles: [],
    pickups: [],
    stats: { kills: 0, fares: 0, carsStolen: 0, packages: 0, distance: 0 },
    fare: null,
    fareTimer: 6,
    fareMarker: null,
    rival: null,
    rivalFinished: false,
    message: '',
    messageTimer: 0,
    busted: false,
    wasted: false,
    storyDone: false,
    attract: { x: 1800, y: 1300, angle: 0 },
  };
  let nextCarId = 1;
  let nextPedId = 1;

  function say(text, seconds = 3) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function addCash(n) {
    state.cash += n;
    return n;
  }

  function addWanted(n) {
    if (n <= 0) return;
    state.wantedFloat = Math.min(WANTED.max, state.wantedFloat + n);
    state.wanted = Math.floor(state.wantedFloat);
    state.lastCrime = state.time;
  }

  function setWanted(n) {
    state.wantedFloat = n;
    state.wanted = n;
    state.lastCrime = state.time;
  }

  function makeCar(x, y, angle, kind, color) {
    return {
      id: nextCarId += 1, x, y, angle, speed: 0, color: color || pick(random, CAR_COLORS),
      kind, health: CAR.health, stolen: false, driver: kind === 'traffic' ? 'traffic' : 'none',
      targetSpeed: 0, turnCooldown: range(random, 1, 4), dead: false, smoke: 0,
    };
  }

  function makePed(x, y, kind) {
    return {
      id: nextPedId += 1, x, y, angle: range(random, 0, Math.PI * 2), speed: 0,
      kind, health: kind === 'gang' ? 50 : 30, state: 'walk', timer: range(random, 2, 6),
      shirt: kind === 'cop' ? '#1f4fd8' : kind === 'gang' ? '#b03030' : pick(random, PED_SHIRTS),
      shootCooldown: range(random, 0.5, 1.5), down: 0, target: null, dead: false,
    };
  }

  function spawnTrafficCar(farFromPlayer) {
    for (let tries = 0; tries < 12; tries += 1) {
      const p = city.randomRoadPoint();
      if (farFromPlayer && dist2(p.x, p.y, state.player.x, state.player.y) < 500 * 500) continue;
      if (state.cars.some((c) => dist2(c.x, c.y, p.x, p.y) < 120 * 120)) continue;
      const vertical = random() < 0.5;
      const angle = vertical ? (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (random() < 0.5 ? 0 : Math.PI);
      const car = makeCar(p.x, p.y, angle, 'traffic');
      car.targetSpeed = TRAFFIC.speed + range(random, -TRAFFIC.speedJitter, TRAFFIC.speedJitter);
      state.cars.push(car);
      return car;
    }
    return null;
  }

  function spawnPed(farFromPlayer) {
    for (let tries = 0; tries < 12; tries += 1) {
      const p = city.randomSidewalkPoint();
      if (farFromPlayer && dist2(p.x, p.y, state.player.x, state.player.y) < 400 * 400) continue;
      if (state.peds.some((d) => dist2(d.x, d.y, p.x, p.y) < 60 * 60)) continue;
      const ped = makePed(p.x, p.y, 'civilian');
      state.peds.push(ped);
      return ped;
    }
    return null;
  }

  function spawnParkedCars() {
    for (const spot of city.parkedSpots) {
      const car = makeCar(spot.x, spot.y, spot.angle, 'parked');
      car.driver = 'none';
      state.cars.push(car);
    }
  }

  function spawnPickups() {
    for (const pkg of city.packages) {
      state.pickups.push({ kind: 'package', x: pkg.x, y: pkg.y, taken: false, bob: range(random, 0, 6) });
    }
    state.pickups.push({ kind: 'ammo', x: 1120, y: 1720, taken: false, bob: 0 });
    state.pickups.push({ kind: 'health', x: 2720, y: 1120, taken: false, bob: 0 });
    state.pickups.push({ kind: 'ammo', x: 2320, y: 640, taken: false, bob: 0 });
  }

  function reset(full) {
    state.time = 0;
    state.cash = ECONOMY.startCash;
    state.wanted = 0;
    state.wantedFloat = 0;
    state.lastCrime = -100;
    state.player.x = 720;
    state.player.y = 950;
    state.player.angle = -Math.PI / 2;
    state.player.health = PLAYER.health;
    state.player.ammo = PISTOL.startAmmo;
    state.player.car = null;
    state.player.punchCooldown = 0;
    state.player.shootCooldown = 0;
    state.cars = [];
    state.peds = [];
    state.particles = [];
    state.pickups = [];
    state.stats = { kills: 0, fares: 0, carsStolen: 0, packages: 0, distance: 0 };
    state.fare = null;
    state.fareTimer = 6;
    state.fareMarker = null;
    state.rival = null;
    state.rivalFinished = false;
    state.busted = false;
    state.wasted = false;
    state.storyDone = false;
    nextCarId = 1;
    nextPedId = 1;
    spawnParkedCars();
    spawnPickups();
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar(false);
    for (let i = 0; i < 34; i += 1) spawnPed(false);
    missions.start(0);
    if (full) say('Welcome to Solmar. Steal a car — press E near one.', 5);
  }

  function nearestCar(x, y, maxDist, kinds) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      if (car.dead || (kinds && !kinds.includes(car.kind))) continue;
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function nearestPed(x, y, maxDist, kinds) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const ped of state.peds) {
      if (ped.dead || ped.state === 'down' || (kinds && !kinds.includes(ped.kind))) continue;
      const d = dist2(x, y, ped.x, ped.y);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  function anyCopNear(x, y, radius) {
    for (const car of state.cars) {
      if (car.kind === 'police' && !car.dead && dist2(x, y, car.x, car.y) < radius * radius) return true;
    }
    for (const ped of state.peds) {
      if (ped.kind === 'cop' && !ped.dead && dist2(x, y, ped.x, ped.y) < radius * radius) return true;
    }
    return false;
  }

  function burst(x, y, color, n, speed, life, size) {
    for (let i = 0; i < n; i += 1) {
      const a = range(random, 0, Math.PI * 2);
      const s = range(random, speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: range(random, life * 0.5, life), maxLife: life, color, size: range(random, size * 0.6, size * 1.4),
      });
    }
  }

  function rayBlocked(x0, y0, x1, y1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 24);
    for (let i = 1; i < steps; i += 1) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      if (city.hitsBuilding(x, y, 4)) return true;
    }
    return false;
  }

  function damagePed(ped, dmg, fromPlayer) {
    ped.health -= dmg;
    burst(ped.x, ped.y, '#e5484d', 6, 120, 0.4, 3);
    if (ped.health <= 0 && !ped.dead) {
      ped.dead = true;
      ped.state = 'down';
      if (fromPlayer) {
        state.stats.kills += 1;
        if (ped.kind === 'gang' && random() < 0.5) {
          state.pickups.push({ kind: 'ammo', x: ped.x, y: ped.y, taken: false, bob: 0 });
        }
        if (ped.kind === 'civilian') addWanted(1);
        if (ped.kind === 'cop') addWanted(1);
      }
    }
  }

  function shootAt(x, y, angle, rangePx, damage, fromPlayer) {
    const tx = x + Math.cos(angle) * rangePx;
    const ty = y + Math.sin(angle) * rangePx;
    let best = null;
    let bestD = rangePx;
    const targets = [];
    for (const ped of state.peds) if (!ped.dead) targets.push({ x: ped.x, y: ped.y, r: 16, ref: ped, isPed: true });
    for (const car of state.cars) {
      if (car.dead) continue;
      if (fromPlayer && car === state.player.car) continue;
      targets.push({ x: car.x, y: car.y, r: 26, ref: car, isPed: false });
    }
    for (const t of targets) {
      const dx = t.x - x;
      const dy = t.y - y;
      const along = dx * Math.cos(angle) + dy * Math.sin(angle);
      if (along < 0 || along > rangePx) continue;
      const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
      if (perp > t.r + 6) continue;
      if (along < bestD && !rayBlocked(x, y, t.x, t.y)) {
        bestD = along;
        best = t;
      }
    }
    const hx = best ? best.ref.x : tx;
    const hy = best ? best.ref.y : ty;
    burst(hx, hy, '#ffd23e', 4, 90, 0.25, 2.5);
    if (best) {
      if (best.isPed) damagePed(best.ref, damage, fromPlayer);
      else {
        best.ref.health -= damage;
        if (best.ref.health <= 0 && !best.ref.dead) explodeCar(best.ref);
      }
    }
    return best !== null;
  }

  function explodeCar(car) {
    car.dead = true;
    burst(car.x, car.y, '#ff7a2e', 26, 260, 0.8, 5);
    burst(car.x, car.y, '#3a3a42', 18, 160, 1.1, 7);
    if (state.player.car === car) {
      state.player.car = null;
      state.player.health -= 25;
      state.player.x = car.x + 40;
      state.player.y = car.y;
    }
    if (dist2(car.x, car.y, state.player.x, state.player.y) < 120 * 120) {
      state.player.health -= 20;
    }
  }

  function enterCar(car) {
    if (car.kind === 'police') {
      say('That is a police cruiser — locked.', 2);
      return false;
    }
    if (car.driver === 'traffic') {
      const driver = makePed(car.x + 30, car.y, 'civilian');
      driver.state = 'flee';
      driver.timer = 4;
      state.peds.push(driver);
      car.driver = 'none';
    }
    car.driver = 'player';
    car.stolen = true;
    state.player.car = car;
    state.player.angle = car.angle;
    state.stats.carsStolen += 1;
    addWanted(CAR.stealWanted);
    return true;
  }

  function exitCar() {
    const car = state.player.car;
    if (!car) return;
    car.driver = 'none';
    car.speed = 0;
    state.player.car = null;
    const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 34, y: car.y + Math.sin(car.angle + Math.PI / 2) * 34 };
    const p = city.clampWalk(side.x, side.y);
    state.player.x = p.x;
    state.player.y = p.y;
    state.player.angle = car.angle;
  }

  function spawnGang(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const px = x + range(random, -160, 160);
      const py = y + range(random, -160, 160);
      const ped = makePed(px, py, 'gang');
      state.peds.push(ped);
    }
    say('Los Lobos are here — fight!', 3);
  }

  function spawnRival(checkpoints) {
    const first = checkpoints[0];
    const car = makeCar(first.x - 120, first.y, 0, 'rival', '#b03030');
    car.driver = 'rival';
    car.checkpoints = checkpoints;
    car.checkpointIndex = 0;
    car.targetSpeed = 470;
    state.cars.push(car);
    state.rival = car;
    state.rivalFinished = false;
  }

  function clearRival() {
    if (state.rival) {
      state.rival.dead = true;
      state.rival = null;
    }
  }

  // ---- police ----
  function spawnPolice() {
    const want = WANTED.copsPerStar[state.wanted] || 0;
    const have = state.cars.filter((c) => c.kind === 'police' && !c.dead).length;
    if (have >= want) return;
    for (let tries = 0; tries < 8; tries += 1) {
      const p = city.randomRoadPoint();
      if (dist2(p.x, p.y, state.player.x, state.player.y) < 650 * 650) continue;
      if (dist2(p.x, p.y, state.player.x, state.player.y) > 1400 * 1400) continue;
      const car = makeCar(p.x, p.y, angleTo(p.x, p.y, state.player.x, state.player.y), 'police', '#20306e');
      car.driver = 'police';
      car.targetSpeed = WANTED.copSpeed[state.wanted] || 470;
      state.cars.push(car);
      return;
    }
  }

  function spawnFootCop() {
    const want = WANTED.footCopsPerStar[state.wanted] || 0;
    const have = state.peds.filter((d) => d.kind === 'cop' && !d.dead).length;
    if (have >= want) return;
    const p = city.randomRoadPoint();
    if (dist2(p.x, p.y, state.player.x, state.player.y) < 400 * 400) return;
    const ped = makePed(p.x, p.y, 'cop');
    ped.state = 'chase';
    state.peds.push(ped);
  }

  function updateWanted(dt) {
    if (state.wanted > 0) {
      const nearestCop = Math.min(
        ...state.cars.filter((c) => c.kind === 'police' && !c.dead).map((c) => Math.sqrt(dist2(c.x, c.y, state.player.x, state.player.y))),
        ...state.peds.filter((d) => d.kind === 'cop' && !d.dead).map((d) => Math.sqrt(dist2(d.x, d.y, state.player.x, state.player.y))),
        Infinity,
      );
      if (nearestCop > WANTED.loseWantedRadius && state.time - state.lastCrime > WANTED.decayDelay) {
        // One star fades roughly every 14 seconds while no cop can see the player.
        state.wantedFloat = Math.max(0, state.wantedFloat - dt * WANTED.decayRate);
        const w = Math.floor(state.wantedFloat);
        if (w !== state.wanted) {
          state.wanted = w;
          if (w === 0) say('You lost them. The heat is off.', 3);
        }
      }
      spawnPolice();
      spawnFootCop();
    } else {
      // No heat: police drive off and foot cops walk away.
      for (const car of state.cars) {
        if (car.kind === 'police' && !car.dead) {
          car.driver = 'traffic';
          car.kind = 'traffic';
          car.targetSpeed = TRAFFIC.speed;
          car.color = pick(random, CAR_COLORS);
        }
      }
      for (const ped of state.peds) {
        if (ped.kind === 'cop' && !ped.dead) {
          ped.kind = 'civilian';
          ped.state = 'walk';
          ped.shirt = pick(random, PED_SHIRTS);
        }
      }
    }
  }

  // ---- fares ----
  function updateFare(dt) {
    if (!state.player.car) {
      if (state.fare) {
        state.fare = null;
        state.fareMarker = null;
      }
      return;
    }
    if (!state.fare) {
      state.fareTimer -= dt;
      if (state.fareTimer <= 0) {
        const p = city.randomRoadPoint();
        const d = Math.sqrt(dist2(p.x, p.y, state.player.x, state.player.y));
        if (d > 350 && d < 1100) {
          state.fare = { phase: 'pickup', px: p.x, py: p.y, dx: 0, dy: 0, passenger: null, pay: 0 };
          state.fareMarker = { x: p.x, y: p.y };
          state.fareTimer = 20;
        } else {
          state.fareTimer = 4;
        }
      }
      return;
    }
    const f = state.fare;
    if (f.phase === 'pickup') {
      if (Math.sqrt(dist2(f.px, f.py, state.player.x, state.player.y)) < 70) {
        const dest = city.randomRoadPoint();
        f.phase = 'dropoff';
        f.dx = dest.x;
        f.dy = dest.y;
        const dist = Math.sqrt(dist2(f.px, f.py, f.dx, f.dy));
        f.pay = Math.round(ECONOMY.fareBase + dist * ECONOMY.farePerMetre);
        f.passenger = makePed(f.px, f.py, 'civilian');
        f.passenger.state = 'riding';
        state.peds.push(f.passenger);
        state.fareMarker = { x: f.dx, y: f.dy };
        say('Passenger aboard — take them to the $ marker.', 3);
      }
    } else if (Math.sqrt(dist2(f.dx, f.dy, state.player.x, state.player.y)) < 80) {
      addCash(f.pay);
      state.stats.fares += 1;
      say(`Fare complete — +$${f.pay}`, 3);
      if (f.passenger) {
        f.passenger.state = 'walk';
        f.passenger.x = state.player.x + 40;
        f.passenger.y = state.player.y + 40;
      }
      state.fare = null;
      state.fareMarker = null;
      state.fareTimer = 8;
    }
  }

  function nearShop(kind, radius) {
    const shop = city.shops.find((s) => s.kind === kind);
    if (!shop) return null;
    if (Math.sqrt(dist2(shop.x, shop.y, state.player.x, state.player.y)) < radius) return shop;
    return null;
  }

  function updateShops(dt, input) {
    const p = state.player;
    if (p.car) {
      const spray = nearShop(SHOP_KIND.SPRAY, 110);
      if (spray && state.wanted > 0 && state.cash >= ECONOMY.sprayPrice) {
        state.cash -= ECONOMY.sprayPrice;
        setWanted(0);
        say('Fresh paint — the cops lost your trail.', 3);
      }
      const garage = nearShop(SHOP_KIND.GARAGE, 110);
      if (garage && p.car.health < CAR.health && state.cash >= ECONOMY.repairPrice) {
        state.cash -= ECONOMY.repairPrice;
        p.car.health = CAR.health;
        say('Car repaired at Lena\'s Garage.', 3);
      }
    } else {
      const guns = nearShop(SHOP_KIND.GUNS, 90);
      if (guns && p.ammo < PISTOL.maxAmmo && state.cash >= ECONOMY.ammoPrice) {
        state.cash -= ECONOMY.ammoPrice;
        p.ammo = Math.min(PISTOL.maxAmmo, p.ammo + 48);
        say('Ammo restocked at the Gun Barn.', 3);
      }
      const hospital = nearShop(SHOP_KIND.HOSPITAL, 90);
      if (hospital && p.health < PLAYER.health) {
        p.health = PLAYER.health;
        say('Patched up at Solmar General.', 3);
      }
    }
  }

  function updatePlayerOnFoot(dt, input) {
    const p = state.player;
    const mv = input.move();
    const len = Math.hypot(mv.x, mv.y) || 1;
    const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.moving = mv.x !== 0 || mv.y !== 0;
    if (p.moving) {
      p.angle = Math.atan2(mv.y / len, mv.x / len);
      p.x += (mv.x / len) * speed * dt;
      p.y += (mv.y / len) * speed * dt;
      state.stats.distance += speed * dt;
    }
    const clamped = city.clampWalk(p.x, p.y);
    p.x = clamped.x;
    p.y = clamped.y;
    const hit = city.hitsBuilding(p.x, p.y, PLAYER.radius);
    if (hit) {
      const pushed = circleRectPush(p.x, p.y, PLAYER.radius, hit);
      if (pushed) {
        p.x = pushed.x;
        p.y = pushed.y;
      }
    }
    if (p.punchCooldown > 0) p.punchCooldown -= dt;
    if (p.shootCooldown > 0) p.shootCooldown -= dt;
  }

  function updatePlayerCar(dt, input) {
    const p = state.player;
    const car = p.car;
    if (!car) return;
    const throttle = input.throttle();
    const steer = input.steer();
    const forward = car.speed >= 0 ? 1 : -1;
    if (throttle > 0) car.speed += CAR.accel * dt;
    else if (throttle < 0) {
      car.speed += car.speed > 20 ? -CAR.brake * dt : -CAR.reverseAccel * dt;
    } else {
      car.speed -= car.speed * 0.9 * dt;
    }
    if (input.handbrake()) {
      car.speed -= car.speed * 2.2 * dt;
    }
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    const turn = steer * CAR.turnRate * dt * clamp(Math.abs(car.speed) / 160, 0, 1) * forward;
    car.angle += input.handbrake() ? turn * 1.6 : turn;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = city.hitsBuilding(nx, ny, 24);
    if (hit) {
      const pushed = circleRectPush(nx, ny, 24, hit);
      if (pushed) {
        const impact = Math.abs(car.speed);
        car.x = pushed.x;
        car.y = pushed.y;
        car.speed *= -0.25;
        if (impact > 260) {
          car.health -= Math.round((impact - 260) / 12);
          burst(car.x, car.y, '#c8c8c8', 8, 140, 0.4, 3);
        }
      }
    } else {
      car.x = clamp(nx, 20, WORLD.width - 20);
      car.y = clamp(ny, 20, BEACH.waterY - 40);
    }
    if (Math.abs(car.speed) > 60) {
      state.stats.distance += Math.abs(car.speed) * dt;
      if (random() < 0.25) {
        state.particles.push({
          x: car.x - Math.cos(car.angle) * 26 + range(random, -6, 6),
          y: car.y - Math.sin(car.angle) * 26 + range(random, -6, 6),
          vx: range(random, -20, 20), vy: range(random, -20, 20),
          life: 0.5, maxLife: 0.5, color: 'rgba(200,190,170,0.5)', size: range(random, 3, 6),
        });
      }
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = car.speed;
    if (car.health <= 0 && !car.dead) explodeCar(car);
    if (car.health < 40) {
      car.smoke += dt;
      if (car.smoke > 0.12) {
        car.smoke = 0;
        state.particles.push({
          x: car.x + range(random, -8, 8), y: car.y + range(random, -8, 8),
          vx: range(random, -10, 10), vy: range(random, -30, -10),
          life: 0.9, maxLife: 0.9, color: 'rgba(60,60,60,0.6)', size: 7,
        });
      }
    }
  }

  function updateTrafficCar(car, dt) {
    if (car.kind === 'police' || car.kind === 'rival') return;
    if (car.kind === 'parked') return;
    car.turnCooldown -= dt;
    const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
    // Stay glued to the lane line of the road we are on.
    if (vertical) {
      const road = nearestRoad(car.x, car.y);
      const off = laneOffset(car.angle);
      car.x += (road.at + off.dx - car.x) * Math.min(1, dt * 4);
    } else {
      const road = nearestRoad(car.x, car.y);
      const off = laneOffset(car.angle);
      car.y += (road.at + off.dy - car.y) * Math.min(1, dt * 4);
    }
    // Slow for the car ahead in our lane.
    let ahead = Infinity;
    for (const other of state.cars) {
      if (other === car || other.dead || other.kind === 'parked') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const perp = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < 90 && perp < 30) ahead = Math.min(ahead, along);
    }
    const want = ahead < 90 ? 0 : car.targetSpeed;
    car.speed += clamp(want - car.speed, -500 * dt, 300 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // At an intersection, sometimes turn.
    if (car.turnCooldown <= 0) {
      const road = nearestRoad(car.x, car.y);
      const cross = vertical
        ? ROADS.streets.find((s) => Math.abs(car.y - s) < 34)
        : ROADS.avenues.find((a) => Math.abs(car.x - a) < 34);
      if (cross !== undefined) {
        car.turnCooldown = range(random, 2, 6);
        const roll = random();
        if (roll < 0.24) {
          // Turn left or right onto the crossing road.
          const left = car.angle - Math.PI / 2;
          const right = car.angle + Math.PI / 2;
          car.angle = random() < 0.5 ? left : right;
        }
      }
    }
  }

  function updatePoliceCar(car, dt) {
    const p = state.player;
    const target = angleTo(car.x, car.y, p.x, p.y);
    car.angle += clamp(angleDiff(car.angle, target), -2.4 * dt, 2.4 * dt);
    const want = WANTED.copSpeed[state.wanted] || 470;
    const d = Math.sqrt(dist2(car.x, car.y, p.x, p.y));
    car.speed += clamp((d > 90 ? want : want * 0.4) - car.speed, -600 * dt, 380 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = city.hitsBuilding(nx, ny, 24);
    if (hit) {
      const pushed = circleRectPush(nx, ny, 24, hit);
      if (pushed) {
        car.x = pushed.x;
        car.y = pushed.y;
        car.speed *= 0.4;
        car.angle += 0.6 * dt * (random() < 0.5 ? 1 : -1);
      }
    } else {
      car.x = clamp(nx, 20, WORLD.width - 20);
      car.y = clamp(ny, 20, BEACH.waterY - 40);
    }
    // Ram the player's car (a little at a time — a nudge, not a demolition).
    if (p.car && d < 60) {
      p.car.health -= 0.12;
      car.speed *= 0.6;
    }
    // On foot: the cop stops and sends a foot cop after the player.
    if (!p.car && d < 120 && state.wanted > 0) {
      car.speed *= 0.9;
    }
  }

  function updateRivalCar(car, dt) {
    const cps = car.checkpoints;
    const cp = cps[car.checkpointIndex];
    if (!cp) return;
    const target = angleTo(car.x, car.y, cp.x, cp.y);
    car.angle += clamp(angleDiff(car.angle, target), -2.2 * dt, 2.2 * dt);
    car.speed += clamp(car.targetSpeed - car.speed, -500 * dt, 380 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = city.hitsBuilding(nx, ny, 24);
    if (hit) {
      const pushed = circleRectPush(nx, ny, 24, hit);
      if (pushed) {
        car.x = pushed.x;
        car.y = pushed.y;
        car.speed *= 0.3;
      }
    } else {
      car.x = clamp(nx, 20, WORLD.width - 20);
      car.y = clamp(ny, 20, BEACH.waterY - 40);
    }
    if (Math.sqrt(dist2(car.x, car.y, cp.x, cp.y)) < 110) {
      car.checkpointIndex += 1;
      if (car.checkpointIndex >= cps.length) {
        state.rivalFinished = true;
      }
    }
  }

  function carCollisions() {
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      const a = cars[i];
      if (a.dead || a.kind === 'parked') continue;
      for (let j = i + 1; j < cars.length; j += 1) {
        const b = cars[j];
        if (b.dead || b.kind === 'parked') continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 52 * 52 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (52 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const impact = Math.abs(a.speed - b.speed);
          if (impact > 200) {
            a.health -= 4;
            b.health -= 4;
            burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffd23e', 6, 120, 0.3, 3);
          }
        }
      }
    }
  }

  function updatePed(ped, dt) {
    if (ped.dead) return;
    if (ped.down > 0) {
      ped.down -= dt;
      if (ped.down <= 0) ped.state = 'flee';
      return;
    }
    const p = state.player;
    if (ped.kind === 'gang') {
      const d = Math.sqrt(dist2(ped.x, ped.y, p.x, p.y));
      if (d < 420 && p.health > 0) {
        ped.angle = angleTo(ped.x, ped.y, p.x, p.y);
        if (d > 120) {
          ped.x += Math.cos(ped.angle) * 150 * dt;
          ped.y += Math.sin(ped.angle) * 150 * dt;
        }
        ped.shootCooldown -= dt;
        if (ped.shootCooldown <= 0 && !rayBlocked(ped.x, ped.y, p.x, p.y)) {
          ped.shootCooldown = range(random, 0.9, 1.6);
          const aim = ped.angle + range(random, -0.22, 0.22);
          if (random() < 0.45) {
            const dmg = range(random, 5, 11);
            p.health -= dmg;
            burst(p.x, p.y, '#e5484d', 4, 100, 0.3, 2.5);
          }
          burst(ped.x + Math.cos(aim) * 20, ped.y + Math.sin(aim) * 20, '#ffd23e', 3, 80, 0.2, 2);
        }
      } else {
        ped.state = 'walk';
      }
      const hit = city.hitsBuilding(ped.x, ped.y, 12);
      if (hit) {
        const pushed = circleRectPush(ped.x, ped.y, 12, hit);
        if (pushed) {
          ped.x = pushed.x;
          ped.y = pushed.y;
        }
      }
      return;
    }
    if (ped.kind === 'cop') {
      const d = Math.sqrt(dist2(ped.x, ped.y, p.x, p.y));
      if (state.wanted > 0 && !p.car) {
        ped.angle = angleTo(ped.x, ped.y, p.x, p.y);
        ped.x += Math.cos(ped.angle) * 210 * dt;
        ped.y += Math.sin(ped.angle) * 210 * dt;
        if (d < WANTED.bustRadius) {
          state.busted = true;
        }
      } else {
        ped.state = 'walk';
      }
      return;
    }
    if (ped.state === 'riding') return;
    if (ped.state === 'flee') {
      ped.timer -= dt;
      const away = angleTo(p.x, p.y, ped.x, ped.y);
      ped.angle = away;
      ped.x += Math.cos(away) * 200 * dt;
      ped.y += Math.sin(away) * 200 * dt;
      if (ped.timer <= 0) ped.state = 'walk';
      const hit = city.hitsBuilding(ped.x, ped.y, 12);
      if (hit) {
        const pushed = circleRectPush(ped.x, ped.y, 12, hit);
        if (pushed) {
          ped.x = pushed.x;
          ped.y = pushed.y;
        }
      }
      return;
    }
    // Civilian stroll: walk along the sidewalk, turn at intersections, dodge cars.
    ped.timer -= dt;
    if (ped.timer <= 0) {
      ped.timer = range(random, 2, 6);
      const r = random();
      if (r < 0.6) {
        const road = nearestRoad(ped.x, ped.y);
        if (road.vertical) ped.angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        else ped.angle = random() < 0.5 ? 0 : Math.PI;
      } else {
        ped.angle = range(random, 0, Math.PI * 2);
      }
    }
    const speed = 55 + range(random, -15, 15);
    let nx = ped.x + Math.cos(ped.angle) * speed * dt;
    let ny = ped.y + Math.sin(ped.angle) * speed * dt;
    const nearCar = state.cars.some((c) => !c.dead && c.speed > 60 && dist2(nx, ny, c.x, c.y) < 55 * 55);
    if (nearCar) {
      ped.state = 'flee';
      ped.timer = 2;
      return;
    }
    const hit = city.hitsBuilding(nx, ny, 12);
    if (hit) {
      ped.angle += Math.PI / 2;
      nx = ped.x;
      ny = ped.y;
    }
    const c = city.clampWalk(nx, ny);
    ped.x = c.x;
    ped.y = c.y;
  }

  function updateCarVsPed(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (car.dead || Math.abs(car.speed) < 90) continue;
      for (const ped of state.peds) {
        if (ped.dead || ped.state === 'riding' || ped.state === 'down') continue;
        if (dist2(car.x, car.y, ped.x, ped.y) < 34 * 34) {
          ped.down = 3;
          ped.state = 'down';
          ped.health -= 20;
          burst(ped.x, ped.y, '#e5484d', 8, 140, 0.5, 3);
          if (car.driver === 'player') {
            if (ped.kind === 'cop') addWanted(1);
            else if (anyCopNear(ped.x, ped.y, 600)) addWanted(1);
            if (ped.kind === 'gang' && ped.health <= 0) state.stats.kills += 1;
          }
          car.speed *= 0.85;
        }
      }
    }
    // The player on foot can be run over too — one hit, then a brief grace period.
    if (!p.car) {
      if (p.hurtCooldown > 0) p.hurtCooldown -= dt;
      for (const car of state.cars) {
        if (car.dead || Math.abs(car.speed) < 120) continue;
        if (dist2(car.x, car.y, p.x, p.y) < 30 * 30 && p.hurtCooldown <= 0) {
          p.health -= 18;
          p.hurtCooldown = 0.8;
          burst(p.x, p.y, '#e5484d', 8, 140, 0.5, 3);
          car.speed *= 0.8;
        }
      }
    }
  }

  function updatePickups(dt) {
    const p = state.player;
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      pk.bob += dt;
      if (dist2(pk.x, pk.y, p.x, p.y) < 40 * 40) {
        pk.taken = true;
        if (pk.kind === 'package') {
          addCash(ECONOMY.packageReward);
          state.stats.packages += 1;
          say(`Hidden stash found — +$${ECONOMY.packageReward} (${state.stats.packages}/12)`, 3);
        } else if (pk.kind === 'ammo') {
          p.ammo = Math.min(PISTOL.maxAmmo, p.ammo + 24);
          say('Ammo +24', 2);
        } else if (pk.kind === 'health') {
          p.health = Math.min(PLAYER.health, p.health + 50);
          say('Health +50', 2);
        }
      }
    }
  }

  function playerActions(dt, input, events, extraActions = 0) {
    const p = state.player;
    const actions = input.takeActions() | extraActions;
    if (actions & 4) { // ACTION_ENTER
      if (p.car) {
        exitCar();
      } else {
        const car = nearestCar(p.x, p.y, 80, null);
        if (car) {
          if (enterCar(car)) {
            events |= EVENT_STEAL;
            say('Car stolen — the cops noticed.', 2.5);
          }
        }
      }
    }
    if (actions & 8) { // ACTION_PUNCH
      if (!p.car && p.punchCooldown <= 0) {
        p.punchCooldown = PLAYER.punchCooldown;
        const target = nearestPed(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, PLAYER.punchRange + 14, null);
        if (target) {
          damagePed(target, PLAYER.punchDamage, true);
          target.down = 1.2;
          target.state = 'down';
          events |= EVENT_PUNCH;
          if (target.kind === 'civilian' && anyCopNear(p.x, p.y, 500)) addWanted(1);
        } else {
          events |= EVENT_PUNCH;
        }
      }
    }
    if (!p.car) {
      const mouse = input.mouse();
      const wx = (state.cameraX ?? 0) + mouse.x;
      const wy = (state.cameraY ?? 0) + mouse.y;
      p.aimAngle = angleTo(p.x, p.y, wx, wy);
      const clicked = input.takeClick();
      if ((mouse.down || clicked) && p.shootCooldown <= 0) {
        if (p.ammo > 0) {
          p.ammo -= 1;
          p.shootCooldown = PISTOL.cooldown;
          shootAt(p.x, p.y, p.aimAngle + range(random, -PISTOL.spread, PISTOL.spread), PISTOL.range, PISTOL.damage, true);
          events |= EVENT_SHOT;
          if (anyCopNear(p.x, p.y, 700)) addWanted(1);
        } else if (clicked) {
          say('No ammo — buy more at the Gun Barn.', 2);
        }
      }
    }
    return events;
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 2 * dt;
      pt.vy *= 1 - 2 * dt;
    }
  }

  function respawn() {
    const hospital = city.shops.find((s) => s.kind === SHOP_KIND.HOSPITAL);
    state.player.x = hospital.x;
    state.player.y = hospital.y + 60;
    state.player.car = null;
    state.player.health = PLAYER.health;
    state.player.ammo = Math.max(PISTOL.startAmmo, state.player.ammo);
    state.cash = Math.max(0, state.cash - 150);
    setWanted(0);
    state.busted = false;
    state.wasted = false;
    for (const car of state.cars) {
      if (car.kind === 'police') car.dead = true;
    }
    for (const ped of state.peds) {
      if (ped.kind === 'cop' || ped.kind === 'gang') ped.dead = true;
    }
    say('You woke up at Solmar General. $150 gone.', 4);
  }

  function serialize() {
    return {
      cash: state.cash,
      mission: missions.index,
      packages: state.stats.packages,
      ammo: state.player.ammo,
      health: state.player.health,
      x: state.player.x,
      y: state.player.y,
      kills: state.stats.kills,
      fares: state.stats.fares,
      carsStolen: state.stats.carsStolen,
      takenPackages: state.pickups.filter((pk) => pk.kind === 'package' && pk.taken).length,
      storyDone: state.storyDone,
    };
  }

  function deserialize(data) {
    state.cash = data.cash ?? ECONOMY.startCash;
    state.stats.packages = data.packages ?? 0;
    state.stats.kills = data.kills ?? 0;
    state.stats.fares = data.fares ?? 0;
    state.stats.carsStolen = data.carsStolen ?? 0;
    state.player.ammo = data.ammo ?? PISTOL.startAmmo;
    state.player.health = data.health ?? PLAYER.health;
    state.player.x = data.x ?? 720;
    state.player.y = data.y ?? 950;
    state.storyDone = data.storyDone ?? false;
    missions.start(data.mission ?? 0);
    let taken = 0;
    for (const pk of state.pickups) {
      if (pk.kind === 'package' && taken < (data.takenPackages ?? 0)) {
        pk.taken = true;
        taken += 1;
      }
    }
  }

  /**
   * One fixed step. `input` is the live input object; in attract mode the player is parked
   * and the city just lives (traffic, pedestrians, camera drift). `extraActions` carries
   * one-shot presses the caller already took (E, F) so they are not lost. Returns event flags.
   */
  function step(dt, input, mode, extraActions = 0) {
    let events = EVENT_NONE;
    state.time += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.messageTimer <= 0) state.message = '';

    // Traffic and pedestrians keep the city alive in every mode.
    for (const car of state.cars) {
      if (car.dead) continue;
      if (car.kind === 'police') updatePoliceCar(car, dt);
      else if (car.kind === 'rival') updateRivalCar(car, dt);
      else updateTrafficCar(car, dt);
      if (car.health <= 0 && !car.dead && car.kind !== 'parked') explodeCar(car);
    }
    carCollisions();
    for (const ped of state.peds) updatePed(ped, dt);
    state.cars = state.cars.filter((c) => !c.dead || c === state.player.car);
    state.peds = state.peds.filter((d) => !d.dead || d.state === 'down');
    // Keep the streets populated.
    const trafficCount = state.cars.filter((c) => c.kind === 'traffic').length;
    if (trafficCount < TRAFFIC.count && random() < 0.1) spawnTrafficCar(true);
    const pedCount = state.peds.filter((d) => d.kind === 'civilian').length;
    if (pedCount < 34 && random() < 0.1) spawnPed(true);

    if (mode === 'attract') {
      state.attract.angle += dt * 0.02;
      state.attract.x = 1800 + Math.cos(state.attract.angle) * 500;
      state.attract.y = 1300 + Math.sin(state.attract.angle * 0.7) * 300;
      updateParticles(dt);
      return events;
    }

    if (state.player.car) updatePlayerCar(dt, input);
    else updatePlayerOnFoot(dt, input);
    updateCarVsPed(dt);
    updatePickups(dt);
    updateFare(dt);
    updateShops(dt, input);
    updateWanted(dt);
    events = playerActions(dt, input, events, extraActions);

    // Missions.
    if (!state.storyDone) {
      const me = missions.update(state, dt);
      if (me) {
        if (me.type === 'step') events |= EVENT_MISSION_STEP;
        else if (me.type === 'mission') {
          events |= EVENT_MISSION_DONE;
          addCash(me.reward);
          say(`${me.mission.title} complete — +$${me.reward}`, 4);
          if (missions.index >= 8) {
            state.storyDone = true;
            say('KING OF SOLMAR — you run this city now.', 6);
          }
        } else if (me.type === 'fail') {
          events |= EVENT_MISSION_FAIL;
          say(me.reason, 4);
          missions.start(missions.index);
        }
      }
    }

    // Health regen, slow but steady, when not fighting.
    if (state.player.health > 0 && state.player.health < PLAYER.health && state.wanted === 0) {
      state.player.health = Math.min(PLAYER.health, state.player.health + 1.2 * dt);
    }
    if (state.player.health <= 0 && !state.wasted) {
      state.wasted = true;
      events |= EVENT_WASTED;
    }
    if (state.busted) events |= EVENT_BUSTED;

    updateParticles(dt);
    return events;
  }

  // The mission engine reads the world state directly, so it needs the world's helpers
  // on the same object (spawnGang, setWanted, spawnRival, clearRival, onCheckpoint).
  state.spawnGang = spawnGang;
  state.setWanted = setWanted;
  state.spawnRival = spawnRival;
  state.clearRival = clearRival;
  state.onCheckpoint = (index) => {
    say(`Checkpoint ${index} — keep going!`, 2);
  };

  reset(false);

  return {
    state,
    missions,
    city,
    reset,
    step,
    say,
    addCash,
    addWanted,
    setWanted,
    spawnGang,
    spawnRival,
    clearRival,
    respawn,
    serialize,
    deserialize,
    onCheckpoint(index) {
      say(`Checkpoint ${index} — keep going!`, 2);
    },
    get fareMarker() {
      return state.fareMarker;
    },
  };
}

export { BEACH, ROADS, WORLD };
