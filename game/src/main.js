// main.js — Sunset Harbor: game bootstrap, loop and state machine.
// Wires every system together: title → playing → paused → busted/wasted →
// victory. Owns the player, the camera, shops, the day/night clock, saving,
// and the deterministic screenshot mode (?shot=<scene>&seed=1).

import { createRng, clamp, dist, angleTo, hashSeed } from './random.js';
import { generateCity, LANDMARKS, WORLD_SIZE, buildingAt, collideCircle, clampToWorld, districtAt } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { seedTraffic, topUpTraffic, updateTrafficCar, drivePlayerCar, nearestCar, damageCarsNear, makeCar } from './vehicles.js';
import { seedPedestrians, updatePed, topUpPeds } from './pedestrians.js';
import { createWanted, addCrime, updateWanted, topUpPolice, updatePolice, clearPolice } from './police.js';
import { createCombat, tryShoot, tryPunch, reload, tickCombat, updateBullets, damagePlayer, punchHit, updateEnemy } from './combat.js';
import { createEffects, burst, smoke, floatText, addSkid, muzzle, updateEffects, drawEffects } from './particles.js';
import { createMissions, nextMission, startMission, updateMissions, currentObjective } from './missions.js';
import { drawWorld, drawCar, drawPed, drawPlayer, drawEnemy, drawBullets, drawObjective, drawPoliceOfficer } from './render.js';
import { drawHud, drawTitle, drawPause, drawGameOver, drawVictory } from './hud.js';
import { saveGame, loadSave, hasSave, clearSave } from './save.js';
import { parseShotQuery, stageShotScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const audio = createAudio();

/** The whole game state, in one object (also exposed as window.__game). */
const game = {
  state: 'title',
  menuIndex: 0,
  hasSave: false,
  seed: 20261117,
  city: null,
  rng: null,
  player: { x: 1600, y: 1600, angle: 0, aimAngle: 0, health: 100, speed: 0 },
  playerCar: null,
  cars: [],
  peds: [],
  police: [],
  enemies: [],
  bullets: [],
  wanted: createWanted(),
  combat: createCombat(),
  missions: createMissions(),
  fx: createEffects(),
  money: 150,
  reputation: 0,
  clock: 9 * 3600,
  cam: { x: 1600, y: 1600 },
  time: 0,
  audio,
  landmarks: LANDMARKS,
  gameOverKind: null,
  prevMissionIndex: 0,
  danger: null,
  shotMode: false,
  shopPrompt: null,
  saveFlash: 0,
};

window.__game = game;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

/** Start a fresh story at Sunset Plaza. */
function newGame() {
  const seed = hashSeed('sunset-harbor') ^ 0x5f3759df;
  game.seed = seed;
  game.rng = createRng(seed);
  game.city = generateCity(seed);
  game.player = { x: 1600, y: 1600, angle: 0, aimAngle: 0, health: 100, speed: 0 };
  game.playerCar = null;
  game.cars = seedTraffic(game.city, game.rng, 22);
  game.peds = seedPedestrians(game.rng, 26, 1600, 1600);
  game.police = [];
  game.enemies = [];
  game.bullets = [];
  game.wanted = createWanted();
  game.combat = createCombat();
  game.missions = createMissions();
  game.fx = createEffects();
  game.money = 150;
  game.reputation = 0;
  game.clock = 9 * 3600;
  game.cam = { x: 1600, y: 1600 };
  game.state = 'playing';
  game.prevMissionIndex = 0;
  clearSave();
  startMission(game, game.missions);
  audio.startMusic();
}

/** Continue from the saved game. */
function continueGame() {
  const save = loadSave();
  newGame();
  if (!save) return;
  game.money = save.money;
  game.player.health = save.health;
  game.combat.ammo = save.ammo;
  game.combat.reserve = save.reserve;
  game.combat.armor = save.armor;
  game.missions.index = Math.min(save.missionIndex, 8);
  game.missions.completed = save.completed.slice();
  game.player.x = save.playerX;
  game.player.y = save.playerY;
  game.clock = save.clock;
  game.reputation = save.reputation;
  game.cam = { x: save.playerX, y: save.playerY };
  game.missions.active = null;
}

function enterCar(car) {
  if (car.traffic && car.driver) {
    car.driver = false;
    addCrime(game.wanted, 0.5, (s) => audio.wantedUp());
    floatText(game.fx, car.x, car.y - 30, 'CAR STOLEN!', '#ff5a4e');
    burst(game.fx, car.x, car.y, { count: 8, color: '#ff5a4e', speed: 120 });
  }
  car.traffic = false;
  car.parked = false;
  game.playerCar = car;
  audio.horn();
}

function exitCar() {
  const car = game.playerCar;
  if (!car) return;
  game.playerCar = null;
  car.speed = 0;
  const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 30, y: car.y + Math.sin(car.angle + Math.PI / 2) * 30 };
  if (!buildingAt(game.city, side.x, side.y, 10)) {
    game.player.x = side.x;
    game.player.y = side.y;
  } else {
    game.player.x = car.x - Math.cos(car.angle + Math.PI / 2) * 30;
    game.player.y = car.y - Math.sin(car.angle + Math.PI / 2) * 30;
  }
  game.player.angle = car.angle;
}

/** Respawn after being busted or wasted. */
function respawn(kind) {
  game.gameOverKind = kind;
  game.state = 'gameover';
  game.money = Math.max(0, Math.floor(game.money * 0.9));
  clearPolice(game.police);
  game.wanted = createWanted();
  if (game.playerCar) { game.playerCar.speed = 0; game.playerCar = null; }
  game.enemies = [];
  game.bullets = [];
  if (kind === 'wasted') {
    game.player.x = 2560; game.player.y = 1920; // St. Anselm Hospital
  } else {
    game.player.x = 1280; game.player.y = 1920; // Harbor PD HQ
  }
  game.player.health = 100;
  game.cam = { x: game.player.x, y: game.player.y };
  audio.fail();
}

function nearestShop() {
  const shops = [
    { id: 'paynspray', x: 2240, y: 2240, label: 'Turbo Tune — G: repair + clear heat ($150)', cost: 150 },
    { id: 'gunshop', x: 960, y: 2240, label: 'Ironclad Arms — G: buy ammo ($60)', cost: 60 },
    { id: 'clinic', x: 2240, y: 960, label: 'Harbor Clinic — G: heal up ($80)', cost: 80 },
  ];
  for (const s of shops) {
    if (dist(game.player.x, game.player.y, s.x, s.y) < 90) return s;
  }
  return null;
}

function useShop(shop) {
  if (game.money < shop.cost) {
    floatText(game.fx, game.player.x, game.player.y - 30, 'NOT ENOUGH CASH', '#ff5a4e');
    return;
  }
  game.money -= shop.cost;
  if (shop.id === 'paynspray') {
    if (game.playerCar) game.playerCar.health = 100;
    game.wanted.stars = 0;
    game.wanted.heat = 0;
    clearPolice(game.police);
    floatText(game.fx, game.player.x, game.player.y - 30, 'HEAT CLEARED', '#7ee787');
  } else if (shop.id === 'gunshop') {
    game.combat.reserve += 72;
    floatText(game.fx, game.player.x, game.player.y - 30, '+72 AMMO', '#7ee787');
  } else {
    game.player.health = 100;
    floatText(game.fx, game.player.x, game.player.y - 30, 'PATCHED UP', '#7ee787');
  }
  audio.pickup();
}

/** One fixed simulation step. */
function update(dt) {
  game.time += dt;
  game.clock = (game.clock + dt * 60) % (24 * 3600);
  if (game.saveFlash > 0) game.saveFlash -= dt;
  const rng = game.rng;

  // --- Player ---
  const p = game.player;
  tickCombat(game.combat, dt);
  // Screenshot scenes hold the throttle down so the chase stays a chase.
  if (game.shotDrive) input.keys.add('w');
  const vw = canvas.width;
  const vh = canvas.height;
  const wx = input.mouse.x - vw / 2 + game.cam.x;
  const wy = input.mouse.y - vh / 2 + game.cam.y;
  input.mouse.worldX = wx;
  input.mouse.worldY = wy;
  p.aimAngle = angleTo(p.x, p.y, wx, wy);

  if (game.playerCar) {
    const car = game.playerCar;
    const prevX = car.x;
    const prevY = car.y;
    const crashed = drivePlayerCar(game.city, car, input, dt, game.cars);
    if (crashed && Math.abs(car.speed) > 200) {
      audio.crash();
      burst(game.fx, car.x, car.y, { count: 10, color: '#ffb347', speed: 180 });
      addCrime(game.wanted, 0.05, null);
    }
    if (input.down(' ') && Math.abs(car.speed) > 180) {
      addSkid(game.fx, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, prevX - Math.cos(car.angle) * 20, prevY - Math.sin(car.angle) * 20);
    }
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      burst(game.fx, car.x, car.y, { count: 40, color: '#ff7a3d', speed: 320 });
      audio.explosion();
      game.playerCar = null;
      p.x = car.x + 40; p.y = car.y + 40;
      damagePlayer(p, game.combat, 25);
    }
    if (car.smoke > 0 || car.health < 45) {
      if (Math.random() < dt * 8) smoke(game.fx, car.x, car.y);
    }
    audio.setEngine(Math.abs(car.speed) / 560, true);
    if (input.wasPressed('e')) exitCar();
  } else {
    audio.setEngine(0, false);
    let mx = (input.down('d', 'ArrowRight') ? 1 : 0) - (input.down('a', 'ArrowLeft') ? 1 : 0);
    let my = (input.down('s', 'ArrowDown') ? 1 : 0) - (input.down('w', 'ArrowUp') ? 1 : 0);
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len; my /= len;
      const sp = input.down('Shift') ? 340 : 230;
      const nx = p.x + mx * sp * dt;
      const ny = p.y + my * sp * dt;
      if (!buildingAt(game.city, nx, p.y, 10)) p.x = nx;
      if (!buildingAt(game.city, p.x, ny, 10)) p.y = ny;
      p.angle = Math.atan2(my, mx);
      p.speed = sp;
    } else {
      p.speed = 0;
    }
    clampToWorld(game.city, p, 12);
    if (input.wasPressed('e')) {
      const car = nearestCar(game.cars, p.x, p.y, 70);
      if (car) enterCar(car);
    }
    // Punch.
    if (input.wasPressed('f')) {
      if (tryPunch(game.combat, dt)) {
        audio.punch();
        const hit = punchHit(p, p.aimAngle, game.enemies, game.peds, game.police);
        if (hit === 'ped') addCrime(game.wanted, 0.3, (s) => audio.wantedUp());
        if (hit === 'cop') addCrime(game.wanted, 1, (s) => audio.wantedUp());
        if (hit) burst(game.fx, p.x + Math.cos(p.aimAngle) * 26, p.y + Math.sin(p.aimAngle) * 26, { count: 6, color: '#ffffff', speed: 140 });
      }
    }
    // Shoot.
    if (input.mouse.down || input.mouse.clicked) {
      const b = tryShoot(game.combat, p.x, p.y, p.aimAngle, dt);
      if (b) {
        game.bullets.push(b);
        muzzle(game.fx, p.x, p.y, p.aimAngle);
        audio.shot();
        game.danger = { x: p.x, y: p.y, radius: 320 };
      }
    }
    if (input.wasPressed('r')) reload(game.combat);
  }

  // --- Missions ---
  const missionResult = updateMissions(game, game.missions, dt);
  if (missionResult === 'complete') {
    saveGame(game);
    game.saveFlash = 2;
  }
  if (input.wasPressed('q') && !game.missions.active && nextMission(game.missions)) {
    startMission(game, game.missions);
    audio.mission();
  }

  // --- Shops ---
  game.shopPrompt = nearestShop();
  if (game.shopPrompt && input.wasPressed('g')) useShop(game.shopPrompt);

  // --- Wanted ---
  const committing = input.mouse.clicked;
  updateWanted(game.wanted, dt, committing);
  topUpPolice(game.police, game.wanted, p, rng);
  // Police cars live in the world car list so they render and collide.
  for (const u of game.police) {
    if (u.kind === 'car' && !u.dead && !game.cars.includes(u.car)) game.cars.push(u.car);
  }
  const busted = updatePolice(game.city, game.police, p, game.playerCar, game.wanted, dt, rng);
  if (busted) { respawn('busted'); return; }
  if (p.health <= 0) { respawn('wasted'); return; }

  // --- Traffic, peds, enemies, bullets ---
  topUpTraffic(game.city, game.cars, p, rng, 14);
  for (const car of game.cars) {
    if (car !== game.playerCar) updateTrafficCar(game.city, car, game.cars, dt, rng);
    if (car.dead && car.smoke > 0 && Math.random() < dt * 6) smoke(game.fx, car.x, car.y);
  }
  game.cars = game.cars.filter((c) => !c.dead || dist(c.x, c.y, p.x, p.y) < 1200 || c === game.playerCar);
  topUpPeds(game.peds, rng, p, 22);
  for (const ped of game.peds) updatePed(game.city, ped, dt, rng, game.danger, game.playerCar);
  game.danger = null;
  for (const e of game.enemies) updateEnemy(e, p, dt, game.bullets, rng);
  game.enemies = game.enemies.filter((e) => !e.dead || dist(e.x, e.y, p.x, p.y) < 1500);
  game.bullets = updateBullets(game.city, game.bullets, dt, {
    cars: game.cars,
    peds: game.peds,
    enemies: game.enemies,
    police: game.police,
    player: p,
    buildingAt: (x, y) => buildingAt(game.city, x, y, 0),
    onImpact: (x, y, kind) => { if (kind === 'wall') burst(game.fx, x, y, { count: 3, color: '#c9c9c9', speed: 90 }); },
    onPedShot: () => addCrime(game.wanted, 0.5, (s) => audio.wantedUp()),
    onCopShot: () => addCrime(game.wanted, 1, (s) => audio.wantedUp()),
    onHitPlayer: (dmg) => { if (damagePlayer(p, game.combat, dmg)) { /* handled below */ } },
  });
  if (p.health <= 0) { respawn('wasted'); return; }

  // --- Effects & camera ---
  updateEffects(game.fx, dt);
  const focus = game.playerCar || p;
  if (game.shotMode) {
    // Screenshots: pin the camera to the action, no lag.
    game.cam.x = focus.x;
    game.cam.y = focus.y;
  } else {
    game.cam.x += (focus.x - game.cam.x) * Math.min(1, 6 * dt);
    game.cam.y += (focus.y - game.cam.y) * Math.min(1, 6 * dt);
  }
  game.cam.x = clamp(game.cam.x, canvas.width / 2 - 100, WORLD_SIZE - canvas.width / 2 + 100);
  game.cam.y = clamp(game.cam.y, canvas.height / 2 - 100, WORLD_SIZE - canvas.height / 2 + 100);
  if (game.missions.index !== game.prevMissionIndex) {
    game.prevMissionIndex = game.missions.index;
    saveGame(game);
    game.saveFlash = 2;
  }
}

/** Day/night tint over the world. */
function dayTint() {
  const h = game.clock / 3600;
  if (h >= 6 && h < 10) return 'rgba(255,170,90,0.10)';      // morning gold
  if (h >= 10 && h < 16) return 'rgba(255,240,200,0.05)';    // midday
  if (h >= 16 && h < 19) return 'rgba(255,120,60,0.16)';     // sunset
  if (h >= 19 || h < 5) return 'rgba(10,16,60,0.34)';        // night
  return 'rgba(255,170,120,0.08)';                           // dawn
}

function render() {
  const vw = canvas.width;
  const vh = canvas.height;
  ctx.clearRect(0, 0, vw, vh);
  if (game.state === 'title') {
    drawTitle(ctx, game, vw, vh);
    return;
  }
  const cam = game.cam;
  ctx.save();
  ctx.translate(vw / 2 - cam.x, vh / 2 - cam.y);
  drawWorld(ctx, game, cam, vw, vh);
  const obj = currentObjective(game.missions);
  drawObjective(ctx, obj, game.time);
  for (const car of game.cars) drawCar(ctx, car);
  for (const ped of game.peds) drawPed(ctx, ped);
  for (const u of game.police) if (!u.dead && u.kind === 'foot') drawPoliceOfficer(ctx, u);
  for (const e of game.enemies) drawEnemy(ctx, e);
  if (!game.playerCar) drawPlayer(ctx, game.player, game.player.aimAngle);
  drawBullets(ctx, game.bullets);
  drawEffects(ctx, game.fx, cam);
  ctx.restore();
  // Day/night tint.
  ctx.fillStyle = dayTint();
  ctx.fillRect(0, 0, vw, vh);
  drawHud(ctx, game, vw, vh);
  // Shop prompt.
  if (game.shopPrompt && game.state === 'playing') {
    ctx.save();
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(game.shopPrompt.label).width + 28;
    ctx.fillStyle = 'rgba(8,12,24,0.75)';
    roundRect(ctx, vw / 2 - w / 2, vh - 150, w, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillText(game.shopPrompt.label, vw / 2, vh - 128);
    ctx.restore();
  }
  if (game.saveFlash > 0) {
    ctx.save();
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7ee787';
    ctx.fillText('✓ GAME SAVED', vw / 2, vh - 120);
    ctx.restore();
  }
  if (game.state === 'paused') drawPause(ctx, game, vw, vh);
  if (game.state === 'gameover') drawGameOver(ctx, game, vw, vh, game.gameOverKind);
  if (game.state === 'victory') drawVictory(ctx, game, vw, vh);
}

/** Menu input (title / pause / gameover / victory). */
function updateMenu() {
  const items = game.state === 'title' ? (game.hasSave ? 4 : 3) : game.state === 'paused' ? 4 : 1;
  if (input.wasPressed('ArrowUp', 'w')) { game.menuIndex = (game.menuIndex + items - 1) % items; audio.click(); }
  if (input.wasPressed('ArrowDown', 's')) { game.menuIndex = (game.menuIndex + 1) % items; audio.click(); }
  if (input.wasPressed('Enter', ' ')) activateMenu();
}

function activateMenu() {
  audio.click();
  if (game.state === 'title') {
    const idx = game.menuIndex;
    const offset = game.hasSave ? 0 : 1; // without a save, index 0 is NEW GAME
    const choice = idx + offset;
    if (choice === 0) continueGame();
    else if (choice === 1) newGame();
    else { /* HOW TO PLAY: stays on the title screen */ }
  } else if (game.state === 'paused') {
    if (game.menuIndex === 0) game.state = 'playing';
    else if (game.menuIndex === 1) audio.setMuted(!audio.muted);
    else if (game.menuIndex === 2) { saveGame(game); game.saveFlash = 2; }
    else if (game.menuIndex === 3) { game.state = 'title'; game.menuIndex = 0; game.hasSave = hasSave(); }
  } else if (game.state === 'gameover' || game.state === 'victory') {
    game.state = 'playing';
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (input.anyKey) audio.unlock();
  if (input.wasPressed('m')) audio.setMuted(!audio.muted);
  if (game.state === 'playing') {
    if (input.wasPressed('Escape', 'p')) { game.state = 'paused'; game.menuIndex = 0; }
    else update(dt);
  } else if (game.state === 'title' || game.state === 'paused' || game.state === 'gameover' || game.state === 'victory') {
    updateMenu();
  }
  render();
  input.endFrame();
  requestAnimationFrame(frame);
}

// --- Boot ---
game.hasSave = hasSave();
const shot = parseShotQuery();
if (shot.shot) {
  // Deterministic screenshot mode: stage the scene, simulate a fixed number
  // of steps, paint once, then keep the loop alive for the capture.
  game.shotMode = true;
  game.rng = createRng(shot.seed);
  stageShotScene(game, shot.shot, shot.seed);
  for (let i = 0; i < 45; i++) {
    if (game.state === 'playing') update(1 / 60);
  }
  render();
  requestAnimationFrame(frame);
} else {
  // Normal play: build the city behind the title screen.
  game.rng = createRng(game.seed);
  game.city = generateCity(game.seed);
  game.cars = seedTraffic(game.city, game.rng, 18);
  game.peds = seedPedestrians(game.rng, 20, 1600, 1600);
  requestAnimationFrame(frame);
}
