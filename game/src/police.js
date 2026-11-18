// police.js — the Harbor PD wanted system.
// Crimes raise wanted stars (0-5). Police cars and foot officers spawn at the
// edge of view and chase the player; on foot they try to arrest (busted),
// in a car they ram. Wanted decays when the player stays clean and out of
// sight; the Turbo Tune garage clears it for a fee. Higher stars mean more
// units, faster cars and roadblocks.

import { clamp, dist, angleTo, angleDiff } from './random.js';
import { nearestRoadPoint, WORLD_SIZE } from './city.js';
import { makeCar } from './vehicles.js';

export const WANTED_MAX = 5;

/** How many police units a wanted level fields. */
export function unitsForLevel(stars) {
  return [0, 1, 2, 3, 4, 6][clamp(stars, 0, 5)];
}

/** Heat decay: seconds of clean living to drop one star. */
export function decaySeconds(stars) {
  return [0, 25, 40, 60, 90, 140][clamp(stars, 0, 5)];
}

/** Create the wanted state. */
export function createWanted() {
  return {
    stars: 0,
    heat: 0,          // 0..1 progress toward the next star from crimes
    cleanTimer: 0,    // seconds without a crime
    busted: false,
    bustedTimer: 0,
  };
}

/** Add a crime. amount is in star-fractions; returns true if stars rose. */
export function addCrime(wanted, amount, onRise) {
  if (wanted.stars >= WANTED_MAX) return false;
  const before = wanted.stars;
  wanted.heat += amount;
  wanted.cleanTimer = 0;
  while (wanted.heat >= 1 && wanted.stars < WANTED_MAX) {
    wanted.heat -= 1;
    wanted.stars += 1;
  }
  if (wanted.stars > before && onRise) onRise(wanted.stars);
  return wanted.stars > before;
}

/** Per-frame wanted update: decay while clean. */
export function updateWanted(wanted, dt, committingCrime) {
  if (committingCrime) {
    wanted.cleanTimer = 0;
    return;
  }
  if (wanted.stars === 0) { wanted.heat = 0; return; }
  wanted.cleanTimer += dt;
  const need = decaySeconds(wanted.stars);
  if (wanted.cleanTimer >= need) {
    wanted.cleanTimer = 0;
    wanted.stars -= 1;
    wanted.heat = 0;
  }
}

/** Spawn police units so the field matches the wanted level. */
export function topUpPolice(police, wanted, player, rng) {
  const want = unitsForLevel(wanted.stars);
  const active = police.filter((p) => !p.dead).length;
  for (let i = active; i < want; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(550, 900);
    const px = clamp(player.x + Math.cos(a) * d, 80, WORLD_SIZE - 80);
    const py = clamp(player.y + Math.sin(a) * d, 80, WORLD_SIZE - 80);
    const rp = nearestRoadPoint(px, py);
    const onFoot = wanted.stars <= 1 && rng.chance(0.4);
    if (onFoot) {
      police.push({ kind: 'foot', x: rp.x, y: rp.y, angle: 0, speed: 0, health: 40, dead: false, arrest: 0 });
    } else {
      const car = makeCar('police', rp.x, rp.y, angleTo(rp.x, rp.y, player.x, player.y), {});
      car.police = true;
      car.targetSpeed = 300 + wanted.stars * 40;
      police.push({ kind: 'car', car, x: rp.x, y: rp.y, angle: 0, speed: 0, health: 100, dead: false, arrest: 0 });
    }
  }
  // Cull units that fell far behind.
  for (let i = police.length - 1; i >= 0; i--) {
    const u = police[i];
    const ux = u.kind === 'car' ? u.car.x : u.x;
    const uy = u.kind === 'car' ? u.car.y : u.y;
    if (!u.dead && dist(ux, uy, player.x, player.y) > 2200) {
      if (u.kind === 'car') u.car.dead = true;
      u.dead = true;
    }
  }
}

/** Chase the player. Returns 'busted' when an officer arrests the player. */
export function updatePolice(city, police, player, playerCar, wanted, dt, rng) {
  let busted = false;
  for (const u of police) {
    if (u.dead) continue;
    if (u.kind === 'car') {
      const car = u.car;
      if (car.dead) { u.dead = true; continue; }
      const target = playerCar || player;
      const a = angleTo(car.x, car.y, target.x, target.y);
      car.angle += angleDiff(car.angle, a) * Math.min(1, 2.6 * dt);
      const top = 340 + wanted.stars * 45;
      car.speed += clamp(top - car.speed, -500 * dt, 320 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 30, WORLD_SIZE - 30);
      car.y = clamp(car.y, 30, WORLD_SIZE - 30);
      // Ram the player's car.
      if (playerCar && dist(car.x, car.y, playerCar.x, playerCar.y) < 46) {
        playerCar.health -= 14 * dt;
        playerCar.speed *= 0.94;
        const push = angleTo(playerCar.x, playerCar.y, car.x, car.y);
        playerCar.x -= Math.cos(push) * 20 * dt * 10;
        playerCar.y -= Math.sin(push) * 20 * dt * 10;
      }
      // Ram the player on foot.
      if (!playerCar && dist(car.x, car.y, player.x, player.y) < 34) {
        player.health -= 22 * dt;
      }
    } else {
      const a = angleTo(u.x, u.y, player.x, player.y);
      u.angle = a;
      const sp = playerCar ? 260 : 190;
      u.x += Math.cos(a) * sp * dt;
      u.y += Math.sin(a) * sp * dt;
      u.x = clamp(u.x, 30, WORLD_SIZE - 30);
      u.y = clamp(u.y, 30, WORLD_SIZE - 30);
      if (!playerCar && dist(u.x, u.y, player.x, player.y) < 26) {
        u.arrest += dt;
        if (u.arrest > 1.2) busted = true;
      } else {
        u.arrest = Math.max(0, u.arrest - dt);
      }
    }
  }
  return busted;
}

/** Clear all police (after being busted, paying off, or entering the garage). */
export function clearPolice(police) {
  for (const u of police) {
    if (u.kind === 'car') u.car.dead = true;
    u.dead = true;
  }
}
