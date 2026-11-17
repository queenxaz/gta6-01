// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between screens: title, play, paused, busted, wasted and story
// complete. Progress autosaves to localStorage; a save on this browser resumes from the
// title screen.
//
// ?seed=N fixes the city and traffic. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createSound } from './audio.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_EXPLOSION, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_MISSION_STEP, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_STEAL, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const city = buildCity(rng);
const world = createWorld(rng, city);
const renderer = createRenderer(canvas);
const sound = createSound();
const input = createInput(canvas);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.serialize()));
    const best = readBest();
    const now = { cash: world.state.cash, missions: world.missions.index, carsStolen: world.state.stats.carsStolen };
    if (!best || now.cash > best.cash) window.localStorage.setItem(BEST_KEY, JSON.stringify(now));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, renderer);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let menuIndex = 0;
  let prevMoveY = 0;
  let howTo = false;
  let muted = false;
  let save = readSave();
  let best = readBest();
  let autosaveTimer = 0;
  let showedComplete = false;
  let prevWanted = 0;

  const menuItems = () => {
    const items = [];
    if (save) items.push('continue');
    items.push('new');
    items.push('howto');
    return items;
  };

  function announce(message) {
    status.textContent = message;
  }

  function menuCount() {
    return menuItems().length;
  }

  function startNewGame() {
    world.reset(true);
    save = null;
    screen = SCREEN_PLAY;
    sound.unlock();
    sound.startEngine();
    sound.startMusic();
    announce('Playing. Steal a car — press E near one.');
  }

  function continueGame() {
    world.reset(false);
    if (save) world.deserialize(save);
    screen = SCREEN_PLAY;
    sound.unlock();
    sound.startEngine();
    sound.startMusic();
    announce('Playing. Welcome back to Solmar.');
  }

  function quitToTitle() {
    saveGame();
    save = readSave();
    best = readBest();
    screen = SCREEN_TITLE;
    menuIndex = 0;
    howTo = false;
    sound.stopSiren();
    announce('Solmar. Title screen.');
  }

  function handleTitle() {
    const actions = input.takeActions();
    const mv = input.move();
    if (mv.y !== 0 && mv.y !== prevMoveY) {
      menuIndex = (menuIndex + mv.y + menuCount()) % menuCount();
      sound.click();
    }
    prevMoveY = mv.y;
    if (howTo) {
      if (actions & ACTION_CONFIRM) {
        howTo = false;
        announce('Title screen.');
      }
      return;
    }
    if (actions & ACTION_CONFIRM) {
      const item = menuItems()[menuIndex];
      sound.unlock();
      if (item === 'continue') continueGame();
      else if (item === 'new') startNewGame();
      else if (item === 'howto') {
        howTo = true;
        announce('How to play.');
      }
    }
  }

  function handlePlayEvents(events) {
    if (events & EVENT_SHOT) sound.shot();
    if (events & EVENT_PUNCH) sound.punch();
    if (events & EVENT_CRASH) sound.crash();
    if (events & EVENT_EXPLOSION) sound.explosion();
    if (events & EVENT_PICKUP) sound.pickup();
    if (events & EVENT_CASH) sound.cash();
    if (events & EVENT_STEAL) sound.sirenBlip();
    if (events & EVENT_MISSION_STEP) sound.pickup();
    if (events & EVENT_MISSION_DONE) {
      sound.mission();
      saveGame();
      best = readBest();
      if (world.state.storyDone && !showedComplete) {
        showedComplete = true;
        screen = SCREEN_COMPLETE;
        announce('King of Solmar. You run this city now.');
      }
    }
    if (events & EVENT_MISSION_FAIL) sound.fail();
    if (events & EVENT_BUSTED) {
      sound.fail();
      screen = SCREEN_BUSTED;
      announce('Busted. The Solmar PD caught you.');
    }
    if (events & EVENT_WASTED) {
      sound.fail();
      screen = SCREEN_WASTED;
      announce('Wasted. You went down in the streets of Solmar.');
    }
  }

  function step() {
    const cam = renderer.cameraFor(world, screen);
    world.state.cameraX = cam.x;
    world.state.cameraY = cam.y;
    if (screen === SCREEN_TITLE) {
      world.step(STEP, input, 'attract');
      handleTitle();
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = sound.toggleMute();
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      saveGame();
      announce('Paused.');
      return;
    }
    // takeActions() above drains every one-shot press, so the presses main.js does not
    // use (E to enter a car, F to punch) are handed to the world here, not lost.
    const events = world.step(STEP, input, 'play', actions & ~(ACTION_MUTE | ACTION_PAUSE));
    handlePlayEvents(events);
    // Engine hum follows the car; the siren wails while the heat is on.
    const car = world.state.player.car;
    sound.setEngine(car ? Math.abs(car.speed) / 520 : 0, !!car);
    if (world.state.wanted > 0 && prevWanted === 0) sound.startSiren();
    if (world.state.wanted === 0 && prevWanted > 0) sound.stopSiren();
    prevWanted = world.state.wanted;
    autosaveTimer += STEP;
    if (autosaveTimer >= AUTOSAVE_SECONDS) {
      autosaveTimer = 0;
      saveGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += dt;
    if (screen === SCREEN_PAUSED) {
      const actions = input.takeActions();
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_CONFIRM) {
        quitToTitle();
      }
      renderer.draw(world, screen, { muted });
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        world.respawn();
        saveGame();
        screen = SCREEN_PLAY;
        announce('Playing. Back on the streets.');
      }
      renderer.draw(world, screen, { muted });
      return;
    }
    if (screen === SCREEN_COMPLETE) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Playing. Free roam — the city is yours.');
      }
      renderer.draw(world, screen, { muted });
      return;
    }
    while (accumulator >= STEP) {
      step();
      accumulator -= STEP;
    }
    renderer.draw(world, screen, {
      menuIndex,
      hasSave: !!save,
      best,
      howTo,
      muted,
    });
  }

  let accumulator = 0;
  let last = performance.now();

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame();
      announce('Paused.');
    }
  });

  // A handle for play-testing: the world, the renderer and the current screen.
  window.__solmar = {
    world,
    renderer,
    get screen() { return screen; },
    get save() { return readSave(); },
    newGame: startNewGame,
    quitToTitle,
  };

  announce('Solmar. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
