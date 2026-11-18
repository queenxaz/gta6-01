// shots.js — deterministic screenshot scenes for Sunset Harbor.
// ?shot=<scene>&seed=1 builds a fixed, fully-staged moment of the game:
// title, driving, chase and mission. Each scene sets the player, cars,
// police, mission and camera directly from the seed, then the main loop
// advances a fixed number of simulation steps before the first paint, so a
// headless screenshot always captures the same frame.

import { createRng } from './random.js';
import { generateCity, WORLD_SIZE } from './city.js';
import { makeCar, seedTraffic } from './vehicles.js';
import { seedPedestrians } from './pedestrians.js';
import { makeEnemy } from './combat.js';
import { startMission } from './missions.js';

export const SHOT_SCENES = ['title', 'driving', 'chase', 'mission'];

/** Parse ?shot= and ?seed= from the URL. */
export function parseShotQuery() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  return { shot: SHOT_SCENES.includes(shot) ? shot : null, seed };
}

/** Stage a deterministic scene on a fresh game object. Returns the scene name. */
export function stageShotScene(game, scene, seed) {
  const rng = createRng(seed * 7919 + 13);
  game.city = generateCity(seed);
  game.rng = rng;
  game.state = 'playing';
  game.clock = 17.5 * 3600; // golden hour

  if (scene === 'title') {
    game.state = 'title';
    game.menuIndex = 1;
    game.hasSave = true;
    return scene;
  }

  if (scene === 'driving') {
    // Player cruising downtown in a muscle car, traffic around, sun low.
    // Starts mid-city heading east so the camera never hits the world edge.
    const car = makeCar('muscle', 800, 1600, 0, {});
    car.speed = 420;
    game.cars = seedTraffic(game.city, rng, 14);
    game.cars.push(car);
    game.playerCar = car;
    game.player.x = 800; game.player.y = 1600;
    game.player.health = 100;
    game.peds = seedPedestrians(rng, 16, 800, 1600);
    game.money = 1250;
    game.cam.x = 800; game.cam.y = 1600;
    game.missions.index = 1;
    game.shotDrive = true; // keep the throttle down for the capture
    return scene;
  }

  if (scene === 'chase') {
    // Police chase: wanted 3, two interceptors on the player's tail, player
    // in a coupe speeding down the avenue with a mission objective ahead.
    const car = makeCar('coupe', 1280, 1280, 0, {});
    car.speed = 480;
    game.cars = seedTraffic(game.city, rng, 10);
    game.cars.push(car);
    game.playerCar = car;
    game.player.x = 1280; game.player.y = 1280;
    game.player.health = 82;
    game.wanted.stars = 3;
    game.wanted.heat = 0.4;
    const cop1 = makeCar('police', 1120, 1280, 0, {});
    cop1.speed = 460; cop1.police = true;
    const cop2 = makeCar('police', 1180, 1330, 0.1, {});
    cop2.speed = 440; cop2.police = true;
    game.cars.push(cop1, cop2);
    game.police = [
      { kind: 'car', car: cop1, x: 1120, y: 1280, angle: 0, speed: 0, health: 100, dead: false, arrest: 0 },
      { kind: 'car', car: cop2, x: 1180, y: 1330, angle: 0, speed: 0, health: 100, dead: false, arrest: 0 },
    ];
    game.peds = seedPedestrians(rng, 12, 1280, 1280);
    game.money = 3420;
    game.missions.index = 3;
    startMission(game, game.missions);
    game.cam.x = 1280; game.cam.y = 1280;
    game.shotDrive = true; // keep the throttle down for the capture
    return scene;
  }

  // mission: on foot at the Harbor Cranes shootout, objective beacon live.
  game.player.x = 700; game.player.y = 2900;
  game.player.health = 100;
  game.combat.ammo = 18;
  game.cars = seedTraffic(game.city, rng, 6);
  const van = makeCar('van', 860, 2960, Math.PI / 2, { parked: true, driver: false });
  game.cars.push(van);
  game.peds = seedPedestrians(rng, 10, 800, 2900);
  game.money = 2150;
  game.missions.index = 2;
  startMission(game, game.missions);
  // Jump the mission to its fight step.
  game.missions.active.stepIndex = 1;
  game.enemies = [
    makeEnemy(840, 2920, { health: 60 }),
    makeEnemy(900, 3000, { health: 60 }),
    makeEnemy(760, 3020, { health: 60 }),
  ];
  game.missions.active.stepState = { enemies: game.enemies.slice(), killed: 0 };
  game.cam.x = 800; game.cam.y = 2960;
  return scene;
}
