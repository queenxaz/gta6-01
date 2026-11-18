// combat.js — fists, firearms and damage in Sunset Harbor.
// The player aims with the mouse and fires with a click; F throws a punch.
// Bullets are hitscan-ish projectiles with tracers. Enemies are gang members
// and rival crew who shoot back during missions. Health, armor and ammo live
// here, plus the "wasted" check.

import { dist, angleTo, clamp } from './random.js';

export const PUNCH_DAMAGE = 12;
export const BULLET_DAMAGE = 34;
export const ENEMY_BULLET_DAMAGE = 9;

/** Create the player's combat state. */
export function createCombat() {
  return {
    ammo: 24,
    reserve: 96,
    reloading: 0,
    punchCooldown: 0,
    shootCooldown: 0,
    armor: 0,
  };
}

/** A bullet in flight. */
export function makeBullet(x, y, angle, speed, fromPlayer, damage) {
  return { x, y, angle, speed, fromPlayer, damage, life: 0.9, dead: false };
}

/** Fire the pistol. Returns a bullet or null (no ammo / cooling down). */
export function tryShoot(combat, x, y, angle, dt) {
  if (combat.reloading > 0) return null;
  if (combat.shootCooldown > 0) return null;
  if (combat.ammo <= 0) {
    if (combat.reserve > 0) combat.reloading = 1.1;
    return null;
  }
  combat.ammo -= 1;
  combat.shootCooldown = 0.16;
  return makeBullet(x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, angle, 900, true, BULLET_DAMAGE);
}

/** Throw a punch. Returns true when a punch went out. */
export function tryPunch(combat, dt) {
  if (combat.punchCooldown > 0) return false;
  combat.punchCooldown = 0.45;
  return true;
}

/** Tick cooldowns and reloading once per frame (called by the main loop). */
export function tickCombat(combat, dt) {
  combat.shootCooldown = Math.max(0, combat.shootCooldown - dt);
  combat.punchCooldown = Math.max(0, combat.punchCooldown - dt);
  if (combat.reloading > 0) {
    combat.reloading -= dt;
    if (combat.reloading <= 0) {
      const take = Math.min(24, combat.reserve);
      combat.ammo = take;
      combat.reserve -= take;
    }
  }
}

/** Reload the pistol (R). */
export function reload(combat) {
  if (combat.reloading <= 0 && combat.ammo < 24 && combat.reserve > 0) combat.reloading = 1.1;
}

/** Move bullets and resolve hits against buildings, cars, peds and enemies. */
export function updateBullets(city, bullets, dt, targets) {
  // targets: { cars, peds, enemies, police, player, onHitPlayer(dmg) }
  for (const b of bullets) {
    if (b.dead) continue;
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    const { buildingAt } = targets;
    if (buildingAt && buildingAt(b.x, b.y, 0)) { b.dead = true; targets.onImpact && targets.onImpact(b.x, b.y, 'wall'); continue; }
    let hit = false;
    for (const car of targets.cars || []) {
      if (car.dead) continue;
      if (dist(b.x, b.y, car.x, car.y) < 26) {
        car.health -= b.damage;
        if (car.health <= 0) { car.dead = true; car.smoke = 1; }
        b.dead = true; hit = true;
        targets.onImpact && targets.onImpact(b.x, b.y, 'car');
        break;
      }
    }
    if (hit) continue;
    for (const e of targets.enemies || []) {
      if (e.dead) continue;
      if (dist(b.x, b.y, e.x, e.y) < 16) {
        e.health -= b.damage;
        b.dead = true; hit = true;
        targets.onImpact && targets.onImpact(b.x, b.y, 'flesh');
        if (e.health <= 0) e.dead = true;
        break;
      }
    }
    if (hit) continue;
    for (const p of targets.peds || []) {
      if (p.dead) continue;
      if (dist(b.x, b.y, p.x, p.y) < 14) {
        p.dead = true;
        b.dead = true; hit = true;
        targets.onImpact && targets.onImpact(b.x, b.y, 'flesh');
        targets.onPedShot && targets.onPedShot(p);
        break;
      }
    }
    if (hit) continue;
    for (const u of targets.police || []) {
      if (u.dead || u.kind !== 'foot') continue;
      if (dist(b.x, b.y, u.x, u.y) < 16) {
        u.health -= b.damage;
        b.dead = true; hit = true;
        targets.onImpact && targets.onImpact(b.x, b.y, 'flesh');
        if (u.health <= 0) u.dead = true;
        targets.onCopShot && targets.onCopShot(u);
        break;
      }
    }
    if (hit) continue;
    if (!b.fromPlayer && targets.player) {
      const pl = targets.player;
      if (dist(b.x, b.y, pl.x, pl.y) < 15) {
        b.dead = true;
        targets.onHitPlayer && targets.onHitPlayer(b.damage);
      }
    }
  }
  return bullets.filter((b) => !b.dead);
}

/** Apply damage to the player, armor first. Returns true if the player died. */
export function damagePlayer(player, combat, dmg) {
  if (combat.armor > 0) {
    const absorbed = Math.min(combat.armor, dmg);
    combat.armor -= absorbed;
    dmg -= absorbed;
  }
  player.health -= dmg;
  return player.health <= 0;
}

/** Punch arc: hurt the nearest enemy / ped / cop in front of the player. */
export function punchHit(player, angle, enemies, peds, police) {
  const px = player.x + Math.cos(angle) * 26;
  const py = player.y + Math.sin(angle) * 26;
  for (const e of enemies) {
    if (!e.dead && dist(px, py, e.x, e.y) < 22) { e.health -= PUNCH_DAMAGE; if (e.health <= 0) e.dead = true; return 'enemy'; }
  }
  for (const u of police) {
    if (!u.dead && u.kind === 'foot' && dist(px, py, u.x, u.y) < 22) { u.health -= PUNCH_DAMAGE; if (u.health <= 0) u.dead = true; return 'cop'; }
  }
  for (const p of peds) {
    if (!p.dead && dist(px, py, p.x, p.y) < 22) { p.dead = true; return 'ped'; }
  }
  return null;
}

/** An enemy gunman (mission gang member). */
export function makeEnemy(x, y, opts = {}) {
  return {
    x, y,
    angle: 0,
    health: opts.health || 60,
    speed: opts.speed || 130,
    shootCooldown: 1 + Math.random(),
    dead: false,
    color: opts.color || '#7a2e8a',
    name: opts.name || 'Rival',
    holdX: x, holdY: y,
  };
}

/** Enemy AI: hold ground, strafe a little, shoot at the player when close. */
export function updateEnemy(e, player, dt, bullets, rng) {
  if (e.dead) return;
  const d = dist(e.x, e.y, player.x, player.y);
  const a = angleTo(e.x, e.y, player.x, player.y);
  e.angle = a;
  if (d > 320) {
    e.x += Math.cos(a) * e.speed * dt;
    e.y += Math.sin(a) * e.speed * dt;
  } else if (d < 140) {
    e.x -= Math.cos(a) * e.speed * 0.5 * dt;
    e.y -= Math.sin(a) * e.speed * 0.5 * dt;
  } else {
    e.x += Math.cos(a + Math.PI / 2) * Math.sin(Date.now() / 700 + e.holdX) * 40 * dt;
  }
  e.shootCooldown -= dt;
  if (d < 420 && e.shootCooldown <= 0) {
    e.shootCooldown = 1.1 + rng.range(0, 0.9);
    const spread = rng.range(-0.12, 0.12);
    bullets.push(makeBullet(e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16, a + spread, 640, false, ENEMY_BULLET_DAMAGE));
  }
}
