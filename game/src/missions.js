// The story of Solmar: eight missions for Jax Marlowe, a driver-for-hire who owes Big
// Sal $5,000 and works it off job by job. Each mission is a list of steps; a step is data
// ({type, x, y, ...}) and the engine below evaluates it against the live world state, so
// a mission is easy to read and the world never has to know the story.
import { ECONOMY } from './config.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Lena Cruz',
    briefing: "Lena needs wheels. Steal any car off the street (E) and bring it to her garage.",
    reward: ECONOMY.missionRewards[0],
    steps: [
      { type: 'stealCar', text: 'Steal a car — press E next to one' },
      { type: 'goto', x: 720, y: 880, radius: 90, text: "Drive the car to Lena's Garage" },
    ],
  },
  {
    id: 'the-drop',
    title: 'The Drop',
    giver: 'Big Sal',
    briefing: 'A package is waiting at the Harbor. Pick it up and deliver it to the Bank — fast.',
    reward: ECONOMY.missionRewards[1],
    steps: [
      { type: 'goto', x: 3310, y: 1180, radius: 90, text: 'Pick up the package at the Harbor' },
      { type: 'goto', x: 1520, y: 880, radius: 90, timer: 90, text: 'Deliver to the Bank before time runs out' },
    ],
  },
  {
    id: 'taxi-nights',
    title: 'Taxi Nights',
    giver: 'Lena Cruz',
    briefing: 'The garage needs cash. Run the taxi: pick up fares and drop them off. Two fares.',
    reward: ECONOMY.missionRewards[2],
    steps: [
      { type: 'fare', count: 2, text: 'Complete 2 taxi fares (drive to the $ marker)' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    giver: 'Big Sal',
    briefing: 'The cops are onto us. Get their attention — 2 stars — then shake them and lose the heat.',
    reward: ECONOMY.missionRewards[3],
    steps: [
      { type: 'getWanted', stars: 2, text: 'Raise your wanted level to 2 stars' },
      { type: 'loseWanted', text: 'Lose the cops — stay out of sight until the stars clear' },
    ],
  },
  {
    id: 'harbor-shootout',
    title: 'Harbor Shootout',
    giver: 'Big Sal',
    briefing: 'Los Lobos took our shipment. Go to the Harbor, deal with six of them, then get out.',
    reward: ECONOMY.missionRewards[4],
    steps: [
      { type: 'goto', x: 3310, y: 1180, radius: 110, text: 'Reach the Harbor' },
      { type: 'kill', count: 6, x: 3310, y: 1180, radius: 320, spawn: 6, text: 'Take out 6 Lobos (mouse to aim, click to shoot)' },
      { type: 'goto', x: 320, y: 1480, radius: 90, text: 'Escape to the Hideout' },
    ],
  },
  {
    id: 'grand-prix',
    title: 'Solmar Grand Prix',
    giver: 'Lena Cruz',
    briefing: 'A street race across the city. Beat the rival through all five checkpoints.',
    reward: ECONOMY.missionRewards[5],
    steps: [
      { type: 'race', checkpoints: [
        { x: 720, y: 280 }, { x: 2320, y: 280 }, { x: 3120, y: 1180 },
        { x: 1520, y: 2080 }, { x: 320, y: 580 },
      ], timer: 100, text: 'Race through all 5 checkpoints before the rival' },
    ],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    giver: 'Big Sal',
    briefing: 'The Bank. Trip the alarm, hold off the response for 30 seconds, then vanish.',
    reward: ECONOMY.missionRewards[6],
    steps: [
      { type: 'goto', x: 1520, y: 880, radius: 90, text: 'Reach the Bank' },
      { type: 'survive', seconds: 30, stars: 4, text: 'Hold out — survive 30 seconds at 4 stars' },
      { type: 'goto', x: 320, y: 1480, radius: 90, text: 'Escape to the Hideout' },
    ],
  },
  {
    id: 'king-of-solmar',
    title: 'King of Solmar',
    giver: 'Jax Marlowe',
    briefing: 'The whole city is after you. Survive a full minute at 5 stars, then take the Tower.',
    reward: ECONOMY.missionRewards[7],
    steps: [
      { type: 'survive', seconds: 60, stars: 5, text: 'Survive 60 seconds at 5 stars — the whole city is hunting you' },
      { type: 'goto', x: 1520, y: 590, radius: 110, text: 'Take Solmar Tower — you run this city now' },
    ],
  },
];

export function createMissionEngine() {
  let index = 0;
  let step = 0;
  let t = 0;
  let killsAtStart = 0;
  let faresAtStart = 0;
  let entered = false;

  function current() {
    return index < MISSIONS.length ? MISSIONS[index] : null;
  }

  function currentStep() {
    const m = current();
    return m ? m.steps[step] : null;
  }

  /** Begin mission `i` (0-based) from its first step. */
  function start(i) {
    index = i;
    step = 0;
    t = 0;
    entered = false;
    killsAtStart = 0;
    faresAtStart = 0;
  }

  /** The marker the minimap and the world arrow should point at, or null. */
  function marker(w) {
    const s = currentStep();
    if (!s) return null;
    if (s.type === 'goto' || s.type === 'kill' || s.type === 'survive') return { x: s.x, y: s.y };
    if (s.type === 'race') {
      const cp = s.checkpoints[s.checkpointIndex ?? 0];
      return cp ? { x: cp.x, y: cp.y } : null;
    }
    if (s.type === 'fare') return w.fareMarker;
    return null;
  }

  function objectiveText() {
    const m = current();
    const s = currentStep();
    if (!m || !s) return '';
    return s.text;
  }

  function advance(w) {
    const m = current();
    step += 1;
    t = 0;
    entered = false;
    if (step >= m.steps.length) {
      const reward = m.reward;
      index += 1;
      step = 0;
      return { type: 'mission', mission: m, reward };
    }
    return { type: 'step' };
  }

  /**
   * One step of story. `w` is the world state (player, wanted, stats, and the world's
   * spawn/set helpers). Returns an event object when a step or mission completes or fails.
   */
  function update(w, dt) {
    const m = current();
    if (!m) return null;
    const s = currentStep();
    if (!s) return null;

    if (!entered) {
      entered = true;
      t = 0;
      killsAtStart = w.stats.kills;
      faresAtStart = w.stats.fares;
      if (s.type === 'kill' && s.spawn) w.spawnGang(s.x, s.y, s.spawn);
      if (s.type === 'survive' && s.stars) w.setWanted(s.stars);
      if (s.type === 'race') {
        s.checkpointIndex = 0;
        w.spawnRival(s.checkpoints);
      }
    }
    t += dt;

    if (s.timer && t > s.timer) {
      return { type: 'fail', reason: 'Out of time — the job fell through.' };
    }

    const px = w.player.x;
    const py = w.player.y;
    const near = (x, y, r) => (px - x) * (px - x) + (py - y) * (py - y) < r * r;

    switch (s.type) {
      case 'goto':
        if (near(s.x, s.y, s.radius)) return advance(w);
        break;
      case 'stealCar':
        if (w.player.car && w.player.car.stolen) return advance(w);
        break;
      case 'fare':
        if (w.stats.fares - faresAtStart >= s.count) return advance(w);
        break;
      case 'getWanted':
        if (w.wanted >= s.stars) return advance(w);
        break;
      case 'loseWanted':
        if (w.wanted === 0) return advance(w);
        break;
      case 'kill':
        if (w.stats.kills - killsAtStart >= s.count) return advance(w);
        break;
      case 'survive':
        if (t >= s.seconds) return advance(w);
        break;
      case 'race': {
        const cp = s.checkpoints[s.checkpointIndex];
        if (cp && near(cp.x, cp.y, 110)) {
          s.checkpointIndex += 1;
          w.onCheckpoint(s.checkpointIndex);
          if (s.checkpointIndex >= s.checkpoints.length) {
            w.clearRival();
            return advance(w);
          }
        }
        if (w.rivalFinished) return { type: 'fail', reason: 'The rival beat you to the finish.' };
        break;
      }
      default:
        break;
    }
    return null;
  }

  return {
    get index() { return index; },
    set index(v) { index = v; },
    current,
    currentStep,
    start,
    marker,
    objectiveText,
    update,
  };
}
