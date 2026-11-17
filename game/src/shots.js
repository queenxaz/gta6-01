// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what real play looks like and the same seed always gives the
// same frame.
import { STEP } from './config.js';
import { angleDiff } from './random.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** A fake input the autopilot drives: the world reads it exactly like the real one. */
function fakeInput() {
  const state = {
    moveX: 0, moveY: 0, throttle: 0, steer: 0, handbrake: false,
    mouseX: 640, mouseY: 360, mouseDown: false, actions: 0,
  };
  return {
    state,
    move() { return { x: state.moveX, y: state.moveY }; },
    running() { return false; },
    throttle() { return state.throttle; },
    steer() { return state.steer; },
    handbrake() { return state.handbrake; },
    mouse() { return { x: state.mouseX, y: state.mouseY, down: state.mouseDown }; },
    takeClick() { return false; },
    takeActions() {
      const a = state.actions;
      state.actions = 0;
      return a;
    },
  };
}

/** Steer a car toward `angle` and keep the throttle open. */
function driveToward(input, world, angle) {
  const car = world.state.player.car;
  if (!car) return;
  const diff = angleDiff(car.angle, angle);
  input.state.steer = diff > 0.08 ? 1 : diff < -0.08 ? -1 : 0;
  input.state.throttle = 1;
}

/** Put the player in the parked car nearest (x, y) and drive off in it. */
function stealNearestCar(world, x, y) {
  const s = world.state;
  let best = null;
  let bestD = Infinity;
  for (const car of s.cars) {
    if (car.dead || car.kind !== 'parked') continue;
    const d = (car.x - x) * (car.x - x) + (car.y - y) * (car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return null;
  s.player.x = best.x;
  s.player.y = best.y;
  best.driver = 'player';
  best.stolen = true;
  s.player.car = best;
  s.player.angle = best.angle;
  s.stats.carsStolen += 1;
  return best;
}

function stageStart(world, renderer) {
  world.reset(false);
  const input = fakeInput();
  for (let i = 0; i < 6 / SAMPLE; i += 1) {
    renderer.cameraFor(world, SCREEN_TITLE);
    world.step(SAMPLE, input, 'attract');
  }
  renderer.cameraFor(world, SCREEN_TITLE);
  return { screen: SCREEN_TITLE, ui: { menuIndex: 1, hasSave: false, best: null, howTo: false, muted: false } };
}

function stageDrive(world, renderer) {
  world.reset(false);
  const input = fakeInput();
  stealNearestCar(world, 700, 880);
  // Put the car on the street itself, heading east, and drive for four and a half seconds —
  // far enough to be up to speed, not so far the camera runs out of city.
  const car = world.state.player.car;
  if (car) {
    car.x = 700;
    car.y = 880;
    car.angle = 0;
    world.state.player.x = 700;
    world.state.player.y = 880;
  }
  for (let i = 0; i < 4.5 / SAMPLE; i += 1) {
    renderer.cameraFor(world, SCREEN_PLAY);
    world.state.cameraX = renderer.cam.x;
    world.state.cameraY = renderer.cam.y;
    driveToward(input, world, 0);
    world.step(SAMPLE, input, 'play');
  }
  renderer.cameraFor(world, SCREEN_PLAY);
  world.state.cameraX = renderer.cam.x;
  world.state.cameraY = renderer.cam.y;
  return { screen: SCREEN_PLAY, ui: { muted: false } };
}

function stageChase(world, renderer) {
  world.reset(false);
  const input = fakeInput();
  stealNearestCar(world, 3200, 880);
  const car = world.state.player.car;
  if (car) {
    // Head west from the east side, so the chase ends mid-city with the camera free to
    // centre on the player, not pinned against the map's edge.
    car.x = 3200;
    car.y = 880;
    car.angle = Math.PI;
    world.state.player.x = 3200;
    world.state.player.y = 880;
  }
  world.setWanted(3);
  world.say('The Solmar PD is on your tail — lose them!', 4);
  // Drive west until a police car is right behind the player (or 5 s pass).
  let close = false;
  for (let i = 0; i < 5 / SAMPLE && !close; i += 1) {
    renderer.cameraFor(world, SCREEN_PLAY);
    world.state.cameraX = renderer.cam.x;
    world.state.cameraY = renderer.cam.y;
    driveToward(input, world, Math.PI);
    world.step(SAMPLE, input, 'play');
    if (i > 180 && i % 10 === 0) {
      const s = world.state;
      close = s.cars.some((c) => c.kind === 'police' && !c.dead &&
        (c.x - s.player.x) * (c.x - s.player.x) + (c.y - s.player.y) * (c.y - s.player.y) < 500 * 500);
    }
  }
  world.setWanted(3);
  renderer.cameraFor(world, SCREEN_PLAY);
  world.state.cameraX = renderer.cam.x;
  world.state.cameraY = renderer.cam.y;
  return { screen: SCREEN_PLAY, ui: { muted: false } };
}

function stageMission(world, renderer) {
  world.reset(false);
  const input = fakeInput();
  const s = world.state;
  // Mission 5, the Harbor Shootout: the player starts inside the harbor marker, so the
  // goto step completes at once and the kill step spawns the Lobos around them.
  world.missions.start(4);
  s.player.x = 3260;
  s.player.y = 1180;
  s.player.angle = 0;
  // A short firefight: long enough for shots and muzzle flashes, short enough that Lobos
  // are still standing. The autopilot aims with a human-like wobble, so it lands about
  // half its shots, and the player strafes but stays near the harbor.
  for (let i = 0; i < 3 / SAMPLE; i += 1) {
    renderer.cameraFor(world, SCREEN_PLAY);
    world.state.cameraX = renderer.cam.x;
    world.state.cameraY = renderer.cam.y;
    // Aim at the nearest living gang member and hold the trigger.
    let target = null;
    let bestD = Infinity;
    for (const ped of s.peds) {
      if (ped.dead || ped.kind !== 'gang') continue;
      const d = (ped.x - s.player.x) * (ped.x - s.player.x) + (ped.y - s.player.y) * (ped.y - s.player.y);
      if (d < bestD) {
        bestD = d;
        target = ped;
      }
    }
    if (target) {
      // A wobble of about a body width (deterministic, from the step index), so roughly
      // half the shots land and the fight is still on when the frame is taken.
      const wobX = Math.sin(i * 2.7) * 22;
      const wobY = Math.cos(i * 1.9) * 22;
      input.state.mouseX = target.x - renderer.cam.x + wobX;
      input.state.mouseY = target.y - renderer.cam.y + wobY;
      input.state.mouseDown = true;
      // Strafe sideways, but turn back before leaving the harbor.
      if (s.player.x > 3320) input.state.moveX = -1;
      else if (s.player.x < 3200) input.state.moveX = 1;
      else input.state.moveX = Math.sin(s.time * 1.3) > 0 ? 1 : -1;
      input.state.moveY = 0;
    } else {
      input.state.mouseDown = false;
      input.state.moveX = 0;
    }
    world.step(SAMPLE, input, 'play');
  }
  input.state.mouseDown = false;
  renderer.cameraFor(world, SCREEN_PLAY);
  world.state.cameraX = renderer.cam.x;
  world.state.cameraY = renderer.cam.y;
  return { screen: SCREEN_PLAY, ui: { muted: false } };
}

/**
 * Set the world to the named scene (start, drive, chase or mission; any other name is start)
 * and return the screen and UI to draw over it.
 */
export function stageShot(name, world, renderer) {
  if (name === 'drive') return stageDrive(world, renderer);
  if (name === 'chase') return stageChase(world, renderer);
  if (name === 'mission') return stageMission(world, renderer);
  return stageStart(world, renderer);
}
