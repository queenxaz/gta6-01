// missions.js — the story of Sunset Harbor: eight jobs for fixer Mara Voss.
// A data-driven step engine: each mission is a list of steps (drive to a
// place, steal a specific car, fight a crew, beat the clock, escape the law).
// Completing a mission pays cash, raises reputation, unlocks the next job and
// auto-saves. Finishing all eight is the victory: "King of the Harbor".

import { dist } from './random.js';
import { landmark } from './city.js';
import { makeCar } from './vehicles.js';
import { makeEnemy } from './combat.js';

export const MISSIONS = [
  {
    id: 'first-fare', title: 'First Fare', giver: 'Mara Voss', pay: 200,
    briefing: 'A client waits at Marina Pier. Pick him up and drive him to Sunset Plaza. Drive smooth — he tips for no dents.',
    steps: [
      { type: 'goto', x: 2960, y: 800, label: 'Pick up the client at Marina Pier' },
      { type: 'goto', x: 1600, y: 1600, label: 'Drop the client at Sunset Plaza' },
    ],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', giver: 'Mara Voss', pay: 350,
    briefing: 'A Gullwing Coupe sits outside the Neon Gull Casino. Take it — quietly — and bring it to the Turbo Tune Garage.',
    steps: [
      { type: 'steal', defId: 'coupe', x: 1920, y: 1400, label: 'Steal the Gullwing Coupe at the casino' },
      { type: 'deliver', x: 2240, y: 2240, label: 'Deliver the Coupe to Turbo Tune Garage' },
    ],
  },
  {
    id: 'dockside-trouble', title: 'Dockside Trouble', giver: 'Mara Voss', pay: 500,
    briefing: 'The Crane Crew is muscling in on my docks. Go to the Harbor Cranes and send their boys home. Bring a gun.',
    steps: [
      { type: 'goto', x: 800, y: 2960, label: 'Reach the Harbor Cranes' },
      { type: 'kill', count: 3, x: 800, y: 2960, label: 'Deal with the Crane Crew (0/3)' },
      { type: 'goto', x: 1600, y: 1600, label: 'Report back at Sunset Plaza' },
    ],
  },
  {
    id: 'the-getaway', title: 'The Getaway', giver: 'Mara Voss', pay: 700,
    briefing: 'Grab the package from the Palm Court Motel. The law will be on you the moment you touch it — lose them, then bring it to the plaza.',
    steps: [
      { type: 'goto', x: 480, y: 480, label: 'Grab the package at Palm Court Motel' },
      { type: 'escape', seconds: 20, label: 'Lose the police (stay alive 20s)' },
      { type: 'goto', x: 1600, y: 1600, label: 'Deliver the package to Sunset Plaza' },
    ],
  },
  {
    id: 'neon-run', title: 'Neon Run', giver: 'Rico the Bookie', pay: 800,
    briefing: 'A bet slip worth a fortune has to cross town before the race starts. Ninety seconds. No excuses, no cops, no crashes.',
    steps: [
      { type: 'timed', x: 2560, y: 1920, seconds: 90, label: 'Deliver the slip to St. Anselm Hospital' },
    ],
  },
  {
    id: 'harbor-heist', title: 'Harbor Heist', giver: 'Mara Voss', pay: 1200,
    briefing: 'A Dock Van full of cargo sits at the cranes, guarded. Take the van, deal with the guards, and bring it to the garage.',
    steps: [
      { type: 'steal', defId: 'van', x: 800, y: 2960, label: 'Steal the Dock Van at the cranes' },
      { type: 'kill', count: 4, x: 800, y: 2960, label: 'Deal with the guards (0/4)' },
      { type: 'deliver', x: 2240, y: 2240, label: 'Deliver the van to Turbo Tune Garage' },
    ],
  },
  {
    id: 'street-war', title: 'Street War', giver: 'Mara Voss', pay: 1500,
    briefing: 'The Gull Gang wants Old Town. They get a war instead. Clear their crew out of the plaza and the streets are ours.',
    steps: [
      { type: 'goto', x: 480, y: 1600, label: 'Reach Old Town Plaza' },
      { type: 'kill', count: 5, x: 480, y: 1600, label: 'Clear the Gull Gang (0/5)' },
    ],
  },
  {
    id: 'the-gull-job', title: 'The Gull Job', giver: 'Mara Voss', pay: 2500,
    briefing: 'One last job. The Gull Limo at the casino — the gang boss\'s own ride. Take it, outrun everything Harbor PD throws at you, and bring it to the pier. Do this, and the harbor is yours.',
    steps: [
      { type: 'steal', defId: 'limousine', x: 1920, y: 1400, label: 'Steal the Gull Limo at the casino' },
      { type: 'escape', seconds: 25, label: 'Outrun Harbor PD (stay alive 25s)' },
      { type: 'deliver', x: 2960, y: 800, label: 'Deliver the Limo to Marina Pier' },
    ],
  },
];

/** Create mission state. index = next mission to play. */
export function createMissions() {
  return {
    index: 0,
    completed: [],
    active: null,       // { mission, stepIndex, stepState }
    banner: null,       // { title, sub, timer } shown after start/complete
    failed: null,       // reason string when a timed step fails
    victory: false,
  };
}

/** The mission currently offered (not yet started). */
export function nextMission(missions) {
  return MISSIONS[missions.index] || null;
}

/** Start the next mission. Spawns step actors. */
export function startMission(game, missions) {
  const def = nextMission(missions);
  if (!def) return false;
  missions.active = { mission: def, stepIndex: 0, stepState: {}, startedAt: game.clock };
  enterStep(game, missions);
  missions.banner = { title: def.title, sub: `New job from ${def.giver} — $${def.pay}`, timer: 4 };
  return true;
}

function enterStep(game, missions) {
  const { mission, stepIndex } = missions.active;
  const step = mission.steps[stepIndex];
  const st = missions.active.stepState = {};
  if (step.type === 'steal') {
    const car = makeCar(step.defId, step.x, step.y, 0, { parked: true, driver: false });
    car.missionCar = true;
    game.cars.push(car);
    st.car = car;
  } else if (step.type === 'kill') {
    st.enemies = [];
    for (let i = 0; i < step.count; i++) {
      const e = makeEnemy(step.x + (i - step.count / 2) * 70 + (i % 2) * 30, step.y + ((i * 53) % 120) - 60, { health: 60 });
      game.enemies.push(e);
      st.enemies.push(e);
    }
    st.killed = 0;
  } else if (step.type === 'timed') {
    st.timeLeft = step.seconds;
  } else if (step.type === 'escape') {
    st.timeLeft = step.seconds;
    game.wanted.stars = Math.max(game.wanted.stars, step.type === 'escape' && mission.id === 'the-gull-job' ? 3 : 2);
    game.wanted.heat = 0;
    game.wanted.cleanTimer = -999; // no decay during the escape
  }
}

/** Current objective for the HUD: {x, y, label} or null. */
export function currentObjective(missions) {
  if (!missions.active) return null;
  const step = missions.active.mission.steps[missions.active.stepIndex];
  if (!step) return null;
  if (step.type === 'steal' && missions.active.stepState.car) {
    const c = missions.active.stepState.car;
    return { x: c.x, y: c.y, label: step.label };
  }
  if (step.type === 'kill' || step.type === 'goto' || step.type === 'timed' || step.type === 'deliver') {
    return { x: step.x, y: step.y, label: step.label };
  }
  return { x: 0, y: 0, label: step.label, noMarker: true };
}

/** Advance the mission state machine. Returns 'complete' | 'failed' | null. */
export function updateMissions(game, missions, dt) {
  if (missions.banner) {
    missions.banner.timer -= dt;
    if (missions.banner.timer <= 0) missions.banner = null;
  }
  if (!missions.active) return null;
  const { mission, stepIndex } = missions.active;
  const step = mission.steps[stepIndex];
  const st = missions.active.stepState;
  const player = game.player;
  const inCar = game.playerCar;

  const advance = () => {
    missions.active.stepIndex++;
    if (missions.active.stepIndex >= mission.steps.length) {
      completeMission(game, missions);
      return 'complete';
    }
    enterStep(game, missions);
    return null;
  };

  if (step.type === 'goto') {
    if (dist(player.x, player.y, step.x, step.y) < 70) return advance();
  } else if (step.type === 'steal') {
    const car = st.car;
    if (car && inCar === car) return advance();
    if (car && car.dead) { failMission(game, missions, 'The target car was destroyed.'); return 'failed'; }
  } else if (step.type === 'deliver') {
    if (inCar && dist(inCar.x, inCar.y, step.x, step.y) < 80) return advance();
  } else if (step.type === 'kill') {
    const alive = st.enemies.filter((e) => !e.dead).length;
    const killed = step.count - alive;
    step.label = step.label.replace(/\(\d+\/\d+\)/, `(${killed}/${step.count})`);
    if (alive === 0) return advance();
  } else if (step.type === 'timed') {
    st.timeLeft -= dt;
    if (dist(player.x, player.y, step.x, step.y) < 70) return advance();
    if (st.timeLeft <= 0) { failMission(game, missions, 'Out of time.'); return 'failed'; }
  } else if (step.type === 'escape') {
    st.timeLeft -= dt;
    if (game.wanted.stars === 0) st.timeLeft -= dt * 2; // losing them fast helps
    if (st.timeLeft <= 0) {
      game.wanted.cleanTimer = 0;
      return advance();
    }
  }
  return null;
}

function completeMission(game, missions) {
  const def = missions.active.mission;
  game.money += def.pay;
  game.reputation += 1;
  missions.completed.push(def.id);
  missions.index++;
  missions.active = null;
  missions.banner = { title: 'JOB DONE', sub: `${def.title} — +$${def.pay}`, timer: 4 };
  game.audio.cash();
  game.audio.mission();
  if (missions.index >= MISSIONS.length) {
    missions.victory = true;
    game.state = 'victory';
  }
}

function failMission(game, missions, reason) {
  missions.failed = reason;
  missions.active = null;
  missions.banner = { title: 'JOB FAILED', sub: reason, timer: 4 };
  game.audio.fail();
}

/** Time left on a timed / escape step, or null. */
export function stepTimeLeft(missions) {
  if (!missions.active) return null;
  const st = missions.active.stepState;
  return typeof st.timeLeft === 'number' ? Math.max(0, st.timeLeft) : null;
}
